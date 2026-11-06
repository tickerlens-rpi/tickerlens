"""Real HTTP tests against a RUNNING central API (default localhost:8000).

Start the whole stack first, then from central_api:
  python -m pytest app/deployment_test.py -v -s

Use another address with:  $env:API_URL="http://localhost:8000"
The scrapper needs its Finnhub key, because a first search is fetched live.
Each ticker is fetched once, then answered from the database.

One optional test also asks the scheduler whether it heard about the search.
It runs only if the scheduler answers at SCHEDULER_URL (default
http://localhost:8002), and compose does not publish that port by default.
"""

import json
import os
import time

import httpx
import pytest

BASE_URL = os.getenv("API_URL", "http://localhost:8000")
SCHEDULER_URL = os.getenv("SCHEDULER_URL", "http://localhost:8002")
client = httpx.Client(base_url=BASE_URL, timeout=60)


def is_up(url):
    try:
        return httpx.get(f"{url}/health", timeout=3).status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not is_up(BASE_URL), reason=f"no central API running at {BASE_URL}"
)


def get(path):
    """GETs a path, prints what came back and returns the response."""
    r = client.get(path)
    print(
        f"\nGET {path} -> {r.status_code}  X-Cache={r.headers.get('X-Cache')}"
    )
    return r


def show_prices(body):
    points = body["points"]
    print(f"  range={body['range']}  points={len(points)}")
    print(f"  first: {points[0]}")
    print(f"  last:  {points[-1]}")


# ---------- /health ----------


def test_health():
    r = get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------- /companies/{ticker}/overview ----------


def test_overview():
    r = get("/companies/AAPL/overview")
    print(json.dumps(r.json(), indent=2))
    assert r.status_code == 200
    assert r.headers["X-Cache"] in ("HIT", "MISS")
    o = r.json()
    assert o["ticker"] == "AAPL"
    assert "Apple" in o["name"]
    assert o["exchange"] == "NASDAQ"
    assert o["price"] > 0
    assert o["market_cap"] > 100_000_000_000
    assert o["pe_ratio"] is not None and o["pe_ratio"] > 0
    assert o["eps"] is not None
    assert o["revenue_growth_pct"] is not None
    assert o["change_1d_pct"] is not None
    assert o["change_1w_pct"] is not None
    assert o["last_updated"]


def test_overview_second_call_comes_from_the_database():
    first = get("/companies/AAPL/overview")
    second = get("/companies/AAPL/overview")
    assert first.status_code == second.status_code == 200
    # If this is MISS, the database is not working (wrong password or URL).
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == first.json()


@pytest.mark.parametrize("raw", ["aapl", "$aapl", "AAPL"])
def test_overview_ticker_is_normalized(raw):
    r = get(f"/companies/{raw}/overview")
    assert r.status_code == 200
    assert r.json()["ticker"] == "AAPL"


def test_overview_unknown_ticker_is_404():
    r = get("/companies/ZZZZ/overview")
    print(f"  {r.json()}")
    assert r.status_code == 404


@pytest.mark.parametrize("raw", ["A%20B", "AAPL%3Fx%3D1", "TOOLONGTICKER"])
def test_invalid_ticker_is_422(raw):
    r = get(f"/companies/{raw}/overview")
    assert r.status_code == 422


# ---------- /companies/{ticker}/prices ----------


@pytest.mark.parametrize(
    ("range_", "count"), [("1W", 5), ("1M", 21), ("1Y", 52), ("5Y", 260)]
)
def test_prices_ranges(range_, count):
    r = get(f"/companies/AAPL/prices?range={range_}")
    assert r.status_code == 200
    body = r.json()
    show_prices(body)
    assert body["ticker"] == "AAPL"
    assert body["range"] == range_
    assert len(body["points"]) == count
    assert all(p["close"] > 0 for p in body["points"])
    dates = [p["date"] for p in body["points"]]
    assert dates == sorted(dates)


def test_prices_default_range_is_1m():
    r = get("/companies/AAPL/prices")
    assert r.status_code == 200
    assert r.json()["range"] == "1M"


def test_prices_second_call_comes_from_the_database():
    get("/companies/AAPL/prices?range=1Y")
    second = get("/companies/AAPL/prices?range=1Y")
    assert second.headers["X-Cache"] == "HIT"


def test_prices_bad_range_is_422():
    r1 = get("/companies/AAPL/prices?range=9Y")
    r2 = get("/companies/AAPL/prices?range=1w")
    assert r1.status_code == 422
    assert r2.status_code == 422


def test_prices_unknown_ticker_is_404():
    assert get("/companies/ZZZZ/prices").status_code == 404


# ---------- /companies/{ticker}/news ----------


def test_news():
    r = get("/companies/AAPL/news?limit=5")
    assert r.status_code == 200
    articles = r.json()["articles"]
    for a in articles:
        print(f"  [{a['publisher']}] {a['published_at']}  {a['headline']}")
        print(f"      {a['url']}")
    assert 1 <= len(articles) <= 5
    for a in articles:
        assert a["headline"].strip() != ""
        assert a["url"].startswith("http")
        assert a["publisher"]
        assert a["published_at"] is not None


def test_news_default_limit_is_5():
    articles = get("/companies/AAPL/news").json()["articles"]
    assert 1 <= len(articles) <= 5


def test_news_limit_one_returns_one_article():
    articles = get("/companies/AAPL/news?limit=1").json()["articles"]
    print(f"  {len(articles)} article: {articles[0]['headline']}")
    assert len(articles) == 1


def test_news_second_call_comes_from_the_database():
    get("/companies/AAPL/news?limit=5")
    second = get("/companies/AAPL/news?limit=5")
    assert second.headers["X-Cache"] == "HIT"


def test_news_bad_limit_is_422():
    codes = [
        get(f"/companies/AAPL/news?limit={x}").status_code
        for x in ("0", "21", "abc")
    ]
    print(f"  limit=0, 21, abc -> {codes}")
    assert codes == [422, 422, 422]


def test_news_unknown_ticker_is_404():
    assert get("/companies/ZZZZ/news").status_code == 404


# ---------- the scheduler (optional) ----------


@pytest.mark.skipif(
    not is_up(SCHEDULER_URL),
    reason=f"no scheduler reachable at {SCHEDULER_URL}",
)
def test_a_search_puts_the_ticker_on_the_schedulers_watchlist():
    assert get("/companies/AAPL/overview").status_code == 200
    for _ in range(10):  # central tells the scheduler in the background
        rows = httpx.get(f"{SCHEDULER_URL}/watchlist", timeout=5).json()
        if "AAPL" in [row["ticker"] for row in rows]:
            break
        time.sleep(1)
    print(f"  watchlist: {[row['ticker'] for row in rows]}")
    assert "AAPL" in [row["ticker"] for row in rows]


@pytest.mark.skipif(
    not is_up(SCHEDULER_URL),
    reason=f"no scheduler reachable at {SCHEDULER_URL}",
)
def test_unknown_and_invalid_tickers_never_reach_the_watchlist():
    get("/companies/ZZZZ/overview")
    get("/companies/A%20B/overview")
    time.sleep(2)
    rows = httpx.get(f"{SCHEDULER_URL}/watchlist", timeout=5).json()
    tickers = [row["ticker"] for row in rows]
    assert "ZZZZ" not in tickers
    assert not any(" " in t for t in tickers)