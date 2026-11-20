"""Finnhub provider: company overview figures and company news.

Free tier: 60 calls/minute. The API key is sent in a header (not the URL), so it
can never show up in an error message or a log line.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import time
from urllib.parse import urlsplit
import httpx
from app.abstract_classes import NewsProvider, OverviewProvider
from app.errors import ProviderError, TickerNotFound
from app.models import Article

BASE_URL = "https://finnhub.io/api/v1"
NEWS_WINDOW_DAYS = 30
AGGREGATOR_SOURCES = {"yahoo"}  # Finnhub's feed name, not the outlet that wrote the story
REDIRECT_HOST = "finnhub.io"
REDIRECT_ATTEMPTS = 3

# Display names for common outlets; anything else is named from its domain.
PUBLISHER_NAMES = {
    "finance.yahoo.com": "Yahoo Finance", "yahoo.com": "Yahoo Finance",
    "247wallst.com": "24/7 Wall St.", "apnews.com": "AP", "barrons.com": "Barron's",
    "benzinga.com": "Benzinga", "bloomberg.com": "Bloomberg", "businessinsider.com": "Business Insider",
    "cnbc.com": "CNBC", "cnn.com": "CNN", "forbes.com": "Forbes", "fool.com": "The Motley Fool",
    "ft.com": "Financial Times", "gurufocus.com": "GuruFocus", "insidermonkey.com": "Insider Monkey",
    "investopedia.com": "Investopedia", "investors.com": "Investor's Business Daily",
    "kiplinger.com": "Kiplinger", "marketwatch.com": "MarketWatch", "nytimes.com": "The New York Times",
    "reuters.com": "Reuters", "seekingalpha.com": "Seeking Alpha", "simplywall.st": "Simply Wall St",
    "stocktwits.com": "Stocktwits", "techcrunch.com": "TechCrunch", "theverge.com": "The Verge",
    "thestreet.com": "TheStreet", "trefis.com": "Trefis", "wsj.com": "The Wall Street Journal",
    "zacks.com": "Zacks",
}


def _num(value) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _first(metrics: dict, *keys: str) -> float | None:
    """First metric that exists. Finnhub has used more than one name for some figures."""
    for key in keys:
        value = _num(metrics.get(key))
        if value is not None:
            return value
    return None


def _finnhub_symbol(ticker: str) -> str:
    """'BRK-B' -> 'BRK.B': Finnhub writes share classes with a dot, Yahoo with a dash."""
    return ticker.replace("-", ".")


def _exchange_name(raw: str | None) -> str | None:
    """'NASDAQ NMS - GLOBAL MARKET' -> 'NASDAQ'; 'NEW YORK STOCK EXCHANGE, INC.' -> 'NYSE'."""
    if not raw:
        return None
    upper = raw.upper()
    if upper.startswith("NASDAQ"):
        return "NASDAQ"
    if upper.startswith("NYSE") or upper.startswith("NEW YORK STOCK EXCHANGE"):
        return "NYSE"
    return raw


def _publisher_from_url(url: str) -> str | None:
    """'https://www.benzinga.com/x' -> 'Benzinga'; unknown 'https://news.example.com/x' -> 'Example'."""
    host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
    if not host:
        return None
    parts = host.split(".")
    for i in range(len(parts) - 1):  # 'finance.yahoo.com', then 'yahoo.com'
        name = PUBLISHER_NAMES.get(".".join(parts[i:]))
        if name:
            return name
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in {"co", "com", "org", "net", "ac", "gov"}:
        return parts[-3].capitalize()  # 'example.co.uk'
    return parts[-2].capitalize() if len(parts) >= 2 else host


class FinnhubProvider(OverviewProvider, NewsProvider):
    def __init__(self, api_key: str):
        self._key = api_key

    # ---------- public interface ----------
    def get_overview(self, ticker: str) -> dict:
        symbol = _finnhub_symbol(ticker)
        profile = self._get("/stock/profile2", symbol=symbol)
        if not profile:  # Finnhub returns {} for unknown symbols
            raise TickerNotFound(ticker)
        metrics = (self._get("/stock/metric", symbol=symbol, metric="all") or {}).get("metric") or {}
        quote = self._get("/quote", symbol=symbol)

        price = _num(quote.get("c"))
        if not price:
            raise ProviderError("Finnhub returned no price")
        cap_millions = _num(profile.get("marketCapitalization")) or _first(metrics, "marketCapitalization")
        day = _num(quote.get("dp"))
        week = _num(metrics.get("5DayPriceReturnDaily"))
        return {
            "ticker": ticker,
            "name": profile.get("name") or ticker,
            "exchange": _exchange_name(profile.get("exchange")),
            "price": price,
            "change_1d_pct": round(day, 2) if day is not None else None,
            "change_1w_pct": round(week, 2) if week is not None else None,
            "market_cap": int(cap_millions * 1_000_000) if cap_millions else None,  # Finnhub: millions
            "pe_ratio": _first(metrics, "peTTM", "peBasicExclExtraTTM"),
            "eps": _first(metrics, "epsTTM", "epsBasicExclExtraItemsTTM"),
            "revenue_growth_pct": _first(metrics, "revenueGrowthTTMYoy", "revenueGrowthQuarterlyYoy"),
        }

    def get_news(self, ticker: str, limit: int) -> list[Article]:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=NEWS_WINDOW_DAYS)
        data = self._get("/company-news", symbol=_finnhub_symbol(ticker),
                         **{"from": start.isoformat(), "to": today.isoformat()})
        if not isinstance(data, list):
            raise ProviderError("Unexpected Finnhub news response")
        newest_first = sorted((i for i in data if isinstance(i, dict)),
                              key=lambda i: i.get("datetime") or 0, reverse=True)
        valid = []
        for item in newest_first:
            if not item.get("headline") or not item.get("url"):
                continue
            stamp = item.get("datetime")
            valid.append(Article(
                headline=item["headline"],
                publisher=item.get("source") or None,
                published_at=datetime.fromtimestamp(stamp, tz=timezone.utc) if stamp else None,
                url=item["url"],
                summary=(item.get("summary") or "")[:300] or None,
            ))
        self._resolve_aggregated_publishers(valid[:limit * 2])
        return self._spread_across_publishers(valid, limit)

    def _resolve_aggregated_publishers(self, articles: list[Article]) -> None:
        """Finnhub labels most stories 'Yahoo' (its feed), whoever wrote them. Its news link is a
        redirect to the original article, so the redirect target names the real publisher and
        becomes the article's link. Only the Finnhub hop is requested, never the outlet's page."""
        pending = [a for a in articles
                   if (a.publisher or "").lower() in AGGREGATOR_SOURCES
                   and urlsplit(a.url).hostname == REDIRECT_HOST]
        if not pending:
            return
        with ThreadPoolExecutor(max_workers=4) as pool:
            targets = list(pool.map(self._redirect_target, (a.url for a in pending)))
        for article, target in zip(pending, targets):
            publisher = _publisher_from_url(target) if target else None
            if publisher:
                article.publisher, article.url = publisher, target

    @staticmethod
    def _spread_across_publishers(articles: list[Article], limit: int) -> list[Article]:
        """Newest first, but no publisher fills every slot (FR-7: at least two publishers)."""
        per_publisher = max(1, limit - 1)
        picked, counts = [], {}
        for article in articles:
            if len(picked) == limit:
                break
            if counts.get(article.publisher, 0) < per_publisher:
                picked.append(article)
                counts[article.publisher] = counts.get(article.publisher, 0) + 1
        for article in articles:  # only one publisher available: fill up anyway
            if len(picked) == limit:
                break
            if article not in picked:
                picked.append(article)
        picked.sort(key=lambda a: a.published_at.timestamp() if a.published_at else 0, reverse=True)
        return picked

    # ---------- helpers ----------
    def _get(self, path: str, **params):
        try:
            data = self._http_get(path, params)
        except httpx.HTTPStatusError as e:  # 401 bad key, 403 premium, 429 rate limit
            raise ProviderError(f"Finnhub request failed (HTTP {e.response.status_code})") from None
        except httpx.HTTPError as e:
            raise ProviderError(f"Finnhub request failed ({type(e).__name__})") from None
        except ValueError:
            raise ProviderError("Finnhub returned invalid JSON") from None
        if isinstance(data, dict) and "error" in data:
            raise ProviderError(f"Finnhub: {str(data['error'])[:200]}")
        return data

    def _http_get(self, path: str, params: dict):  # overridden in tests
        response = httpx.get(BASE_URL + path, params=params,
                             headers={"X-Finnhub-Token": self._key}, timeout=15)
        response.raise_for_status()
        return response.json()

    def _redirect_target(self, url: str) -> str | None:  # overridden in tests
        """Where a Finnhub news link redirects, or None. Failures just keep Finnhub's label.
        Finnhub answers bursts with 429, so those are retried briefly."""
        for attempt in range(REDIRECT_ATTEMPTS):
            try:
                response = httpx.get(url, follow_redirects=False, timeout=5)
            except httpx.HTTPError:
                return None
            if response.status_code != 429:
                break
            time.sleep(0.4 * (attempt + 1))
        location = response.headers.get("location") if response.is_redirect else None
        return location if location and location.startswith(("https://", "http://")) else None