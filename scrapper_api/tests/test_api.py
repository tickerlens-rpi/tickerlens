"""Offline tests: no network, no API keys. Run from scrapper_api:  python -m pytest tests/test_api.py -v"""
from datetime import date, datetime, timedelta, timezone
import httpx
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app import main as main_module
from app.abstract_classes import MarketDataProvider, NewsProvider
from app.combined import CombinedProvider
from app.errors import ProviderError, TickerNotFound
from app.finnhub import FinnhubProvider, _exchange_name
from app.main import app, get_market_provider, get_news_provider, normalize_ticker
from app.models import Article, PricePoint
from app.yahoo import YahooPriceProvider, _weekly


# ======================= helpers =======================

class StubProvider(MarketDataProvider, NewsProvider):
    """Fake provider for the API tests. Raises `error` from every method if given."""

    def __init__(self, error=None):
        self.error, self.seen = error, []

    def _check(self, ticker):
        self.seen.append(ticker)
        if self.error:
            raise self.error

    def get_overview(self, ticker):
        self._check(ticker)
        return {"ticker": ticker, "name": "Apple Inc.", "exchange": "NASDAQ", "price": 231.45}

    def get_prices(self, ticker, range_):
        self._check(ticker)
        return [PricePoint(date="2026-10-01", close=230.0), PricePoint(date="2026-10-02", close=231.45)]

    def get_news(self, ticker, limit):
        self._check(ticker)
        return [Article(headline="h", publisher="Reuters", url="https://x.test/a",
                        published_at=datetime(2026, 9, 16, tzinfo=timezone.utc))]


@pytest.fixture
def use_provider():
    def _use(provider):
        app.dependency_overrides[get_market_provider] = lambda: provider
        app.dependency_overrides[get_news_provider] = lambda: provider
        return TestClient(app)
    yield _use
    app.dependency_overrides.clear()


# ======================= ticker normalization =======================

@pytest.mark.parametrize(("raw", "expected"), [
    (" $aapl ", "AAPL"), ("AAPL", "AAPL"), ("$ nke ", "NKE"), ("brk.b", "BRK-B"), ("BRK-B", "BRK-B"),
])
def test_normalize_ticker(raw, expected):
    assert normalize_ticker(raw) == expected


# ======================= API endpoints (stub provider) =======================

def test_health(use_provider):
    assert use_provider(StubProvider()).get("/health").json() == {"status": "ok"}


def test_overview_endpoint_normalizes_ticker(use_provider):
    provider = StubProvider()
    r = use_provider(provider).get("/companies/$aapl/overview")
    assert r.status_code == 200 and r.json()["ticker"] == "AAPL" and "last_updated" in r.json()
    assert provider.seen == ["AAPL"]


def test_prices_endpoint_defaults_to_one_month(use_provider):
    body = use_provider(StubProvider()).get("/companies/AAPL/prices").json()
    assert body["range"] == "1M" and body["ticker"] == "AAPL" and len(body["points"]) == 2


@pytest.mark.parametrize("range_", ["1W", "1M", "1Y", "5Y"])
def test_prices_endpoint_accepts_every_range(use_provider, range_):
    assert use_provider(StubProvider()).get(f"/companies/AAPL/prices?range={range_}").json()["range"] == range_


def test_news_endpoint(use_provider):
    r = use_provider(StubProvider()).get("/companies/AAPL/news")
    assert r.status_code == 200 and r.json()["articles"][0]["publisher"] == "Reuters"


@pytest.mark.parametrize("url", [
    "/companies/AAPL/prices?range=9Y", "/companies/AAPL/prices?range=1w",
    "/companies/AAPL/news?limit=0", "/companies/AAPL/news?limit=21", "/companies/AAPL/news?limit=abc",
])
def test_invalid_query_parameters_return_422(use_provider, url):
    assert use_provider(StubProvider()).get(url).status_code == 422


@pytest.mark.parametrize("limit", [1, 20])
def test_news_limit_boundaries_are_accepted(use_provider, limit):
    assert use_provider(StubProvider()).get(f"/companies/AAPL/news?limit={limit}").status_code == 200


@pytest.mark.parametrize(("error", "status"), [(TickerNotFound("ZZZZ"), 404), (ProviderError("down"), 502)])
@pytest.mark.parametrize("path", ["overview", "prices", "news"])
def test_provider_errors_map_to_http_status(use_provider, error, status, path):
    r = use_provider(StubProvider(error)).get(f"/companies/AAPL/{path}")
    assert r.status_code == status and "detail" in r.json()


@pytest.mark.parametrize("path", ["overview", "prices", "news"])
def test_missing_key_returns_503(monkeypatch, path):
    monkeypatch.setattr(main_module, "_provider", None)
    app.dependency_overrides.clear()
    r = TestClient(app).get(f"/companies/AAPL/{path}")
    assert r.status_code == 503 and "FINNHUB_API_KEY" in r.json()["detail"]


def test_openapi_lists_every_endpoint(use_provider):
    paths = use_provider(StubProvider()).get("/openapi.json").json()["paths"]
    for p in ["/health", "/companies/{ticker}/overview", "/companies/{ticker}/prices", "/companies/{ticker}/news"]:
        assert p in paths


def test_main_needs_only_the_finnhub_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    assert main_module._build_provider() is None
    monkeypatch.setenv("FINNHUB_API_KEY", "abc")
    assert isinstance(main_module._build_provider(), CombinedProvider)


def test_combined_provider_routes_to_the_right_source():
    fundamentals, prices = StubProvider(), StubProvider()
    combined = CombinedProvider(fundamentals=fundamentals, prices=prices)
    combined.get_overview("AAPL")
    combined.get_prices("NKE", "1Y")
    combined.get_news("SBUX", 5)
    assert fundamentals.seen == ["AAPL", "SBUX"] and prices.seen == ["NKE"]


# ======================= Finnhub adapter =======================

PROFILE = {"name": "Apple Inc", "exchange": "NASDAQ NMS - GLOBAL MARKET", "marketCapitalization": 3_400_000.0}
METRICS = {"metric": {"peBasicExclExtraTTM": 34.8, "epsBasicExclExtraItemsTTM": 6.65,
                      "revenueGrowthTTMYoy": 6.1, "5DayPriceReturnDaily": -0.844}}
QUOTE = {"c": 231.45, "dp": 1.2043}


def finnhub_with(monkeypatch, responder):
    provider = FinnhubProvider("secret-key")
    monkeypatch.setattr(provider, "_http_get", responder)
    return provider


def overview_router(profile=PROFILE, metrics=METRICS, quote=QUOTE):
    return lambda path, params: {"/stock/profile2": profile, "/stock/metric": metrics, "/quote": quote}[path]


def test_finnhub_overview_parsing(monkeypatch):
    o = finnhub_with(monkeypatch, overview_router()).get_overview("AAPL")
    assert (o["name"], o["exchange"], o["price"]) == ("Apple Inc", "NASDAQ", 231.45)
    assert (o["change_1d_pct"], o["change_1w_pct"]) == (1.2, -0.84)
    assert o["market_cap"] == 3_400_000_000_000  # Finnhub reports millions
    assert (o["pe_ratio"], o["eps"], o["revenue_growth_pct"]) == (34.8, 6.65, 6.1)


def test_finnhub_metric_name_fallbacks(monkeypatch):
    metrics = {"metric": {"peTTM": 20.0, "epsTTM": 5.0, "revenueGrowthQuarterlyYoy": 3.3}}
    o = finnhub_with(monkeypatch, overview_router(metrics=metrics)).get_overview("AAPL")
    assert (o["pe_ratio"], o["eps"], o["revenue_growth_pct"]) == (20.0, 5.0, 3.3)


def test_finnhub_missing_figures_become_none(monkeypatch):
    o = finnhub_with(monkeypatch, overview_router(profile={"name": "Loss Co"}, metrics={}, quote={"c": 10.0})).get_overview("LOSS")
    assert o["price"] == 10.0
    assert all(o[k] is None for k in ("pe_ratio", "eps", "revenue_growth_pct", "market_cap", "exchange",
                                      "change_1d_pct", "change_1w_pct"))


def test_finnhub_unknown_ticker_and_zero_price(monkeypatch):
    with pytest.raises(TickerNotFound):
        finnhub_with(monkeypatch, overview_router(profile={})).get_overview("ZZZZ")
    with pytest.raises(ProviderError):
        finnhub_with(monkeypatch, overview_router(quote={"c": 0})).get_overview("AAPL")


@pytest.mark.parametrize(("raw", "expected"), [
    ("NASDAQ NMS - GLOBAL MARKET", "NASDAQ"), ("NEW YORK STOCK EXCHANGE, INC.", "NYSE"),
    ("NYSE ARCA", "NYSE"), ("TORONTO STOCK EXCHANGE", "TORONTO STOCK EXCHANGE"), ("", None), (None, None),
])
def test_exchange_name(raw, expected):
    assert _exchange_name(raw) == expected


def test_finnhub_news_parsing_and_30_day_window(monkeypatch):
    calls = []

    def responder(path, params):
        calls.append((path, params))
        return [
            {"headline": "Old", "url": "https://x/old", "source": "CNBC", "datetime": 1_000},
            {"headline": "Newest", "url": "https://x/new", "source": "Reuters", "datetime": 1_790_000_000, "summary": "s" * 500},
            {"headline": "", "url": "https://x/b", "source": "WSJ", "datetime": 1_780_000_000},
            {"headline": "No url", "source": "WSJ", "datetime": 1_780_000_000},
            "not a dict",
        ]

    articles = finnhub_with(monkeypatch, responder).get_news("AAPL", 10)
    assert [a.headline for a in articles] == ["Newest", "Old"]
    assert len(articles[0].summary) == 300 and articles[0].published_at.tzinfo is not None
    path, params = calls[0]
    assert path == "/company-news" and (date.fromisoformat(params["to"]) - date.fromisoformat(params["from"])).days == 30


def test_finnhub_news_spread_across_publishers(monkeypatch):
    yahoo = [{"headline": f"Y{i}", "url": f"https://x/y{i}", "source": "Yahoo", "datetime": 1_790_000_000 - i} for i in range(8)]
    cnbc = {"headline": "C", "url": "https://x/c", "source": "CNBC", "datetime": 1_700_000_000}
    arts = finnhub_with(monkeypatch, lambda p, q: yahoo + [cnbc]).get_news("AAPL", 5)
    assert len(arts) == 5 and {a.publisher for a in arts} == {"Yahoo", "CNBC"}  # FR-7
    assert [a.published_at for a in arts] == sorted((a.published_at for a in arts), reverse=True)


def test_finnhub_single_publisher_still_fills_the_limit(monkeypatch):
    yahoo = [{"headline": f"Y{i}", "url": f"https://x/y{i}", "source": "Yahoo", "datetime": 1_790_000_000 - i} for i in range(8)]
    assert len(finnhub_with(monkeypatch, lambda p, q: yahoo).get_news("AAPL", 5)) == 5


def test_finnhub_empty_and_wrong_news_shape(monkeypatch):
    assert finnhub_with(monkeypatch, lambda p, q: []).get_news("AAPL", 5) == []
    with pytest.raises(ProviderError):
        finnhub_with(monkeypatch, lambda p, q: {"oops": 1}).get_news("AAPL", 5)


def test_finnhub_errors_become_provider_errors_without_leaking_the_key(monkeypatch):
    def status_429(path, params):
        response = httpx.Response(429, request=httpx.Request("GET", "https://finnhub.io/x"))
        raise httpx.HTTPStatusError("too many", request=response.request, response=response)

    def network(path, params):
        raise httpx.ConnectError("failed with token secret-key")

    def bad_json(path, params):
        raise ValueError("Expecting value")

    with pytest.raises(ProviderError, match="429"):
        finnhub_with(monkeypatch, status_429).get_news("AAPL", 5)
    with pytest.raises(ProviderError) as e:
        finnhub_with(monkeypatch, network).get_news("AAPL", 5)
    assert "secret-key" not in str(e.value)
    with pytest.raises(ProviderError):
        finnhub_with(monkeypatch, bad_json).get_news("AAPL", 5)
    with pytest.raises(ProviderError, match="limit"):
        finnhub_with(monkeypatch, lambda p, q: {"error": "API limit reached"}).get_news("AAPL", 5)


def test_finnhub_sends_key_in_header_not_url(monkeypatch):
    seen = {}

    class Response:
        def raise_for_status(self): pass
        def json(self): return []

    def fake_get(url, params=None, headers=None, timeout=None):
        seen.update(url=url, params=params, headers=headers)
        return Response()

    monkeypatch.setattr(httpx, "get", fake_get)
    FinnhubProvider("secret-key").get_news("AAPL", 5)
    assert seen["headers"] == {"X-Finnhub-Token": "secret-key"}
    assert "secret-key" not in seen["url"] and "token" not in seen["params"]


# ======================= Yahoo price adapter =======================

def weekdays(n, end=date(2026, 11, 4)):
    days, d = [], end
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return sorted(days)


def fake_closes(n=1300):
    return [(d.isoformat(), round(100 + i * 0.1, 2)) for i, d in enumerate(weekdays(n))]


def yahoo_with(closes=None, error=None):
    p = YahooPriceProvider()
    p.calls = 0

    def download(ticker):
        p.calls += 1
        if error:
            raise error
        return closes
    p._download = download
    return p


def test_yahoo_range_sizes_and_order():
    p = yahoo_with(fake_closes())
    for rng, n in [("1W", 5), ("1M", 21), ("1Y", 52), ("5Y", 260)]:
        pts = p.get_prices("AAPL", rng)
        assert len(pts) == n and [x.date for x in pts] == sorted(x.date for x in pts)
    assert p.get_prices("AAPL", "1W")[-1].date == fake_closes()[-1][0]


def test_yahoo_weekly_keeps_last_trading_day_of_each_week():
    weekly = _weekly(fake_closes(30))
    assert len(weekly) == 7  # 30 weekdays ending Wed Nov 4 touch 7 ISO weeks
    assert all(date.fromisoformat(d).weekday() == 4 for d, _ in weekly[:-1])
    assert weekly[-1][0] == "2026-11-04"


def test_yahoo_one_download_serves_all_ranges():
    p = yahoo_with(fake_closes())
    for rng in ("1W", "1M", "1Y", "5Y"):
        p.get_prices("AAPL", rng)
    assert p.calls == 1


def test_yahoo_stale_copy_served_when_download_fails():
    p = yahoo_with(fake_closes())
    p.get_prices("AAPL", "1W")
    p._cache["AAPL"] = (0, p._cache["AAPL"][1])  # age the cache
    p._download = lambda t: (_ for _ in ()).throw(ProviderError("rate limit"))
    assert len(p.get_prices("AAPL", "1W")) == 5


def test_yahoo_errors_without_cache_propagate():
    with pytest.raises(ProviderError):
        yahoo_with(error=ProviderError("x")).get_prices("AAPL", "1W")
    with pytest.raises(TickerNotFound):
        yahoo_with(error=TickerNotFound("ZZZZ")).get_prices("ZZZZ", "1W")


def test_yahoo_parse_frame():
    frame = pd.DataFrame({"Close": [10.123, None, 12.0]}, index=pd.to_datetime(["2026-11-02", "2026-11-03", "2026-11-04"]))
    assert YahooPriceProvider._parse_frame(frame, "X") == [("2026-11-02", 10.12), ("2026-11-04", 12.0)]


@pytest.mark.parametrize("frame", [None, pd.DataFrame()])
def test_yahoo_empty_frame_is_ticker_not_found(frame):
    with pytest.raises(TickerNotFound):
        YahooPriceProvider._parse_frame(frame, "ZZZZ")


def test_yahoo_bad_frames_are_provider_errors():
    idx = pd.to_datetime(["2026-11-02"])
    with pytest.raises(ProviderError):
        YahooPriceProvider._parse_frame(pd.DataFrame({"Open": [1.0]}, index=idx), "X")
    with pytest.raises(ProviderError):
        YahooPriceProvider._parse_frame(pd.DataFrame({"Close": [None]}, index=idx), "X")


def test_yahoo_library_exceptions_become_provider_errors(monkeypatch):
    import yfinance as yf

    def rate_limited(self, **kw):
        raise yf.exceptions.YFRateLimitError()

    def other(self, **kw):
        raise RuntimeError("secret detail")

    monkeypatch.setattr(yf.Ticker, "history", rate_limited)
    with pytest.raises(ProviderError, match="rate limit"):
        YahooPriceProvider()._download("AAPL")
    monkeypatch.setattr(yf.Ticker, "history", other)
    with pytest.raises(ProviderError) as e:
        YahooPriceProvider()._download("AAPL")
    assert "secret detail" not in str(e.value)
