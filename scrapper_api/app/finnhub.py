"""Finnhub provider: company overview figures and company news.

Free tier: 60 calls/minute. The API key is sent in a header (not the URL), so it
can never show up in an error message or a log line.
"""
from datetime import datetime, timedelta, timezone
import time
import httpx
from app.abstract_classes import NewsProvider, OverviewProvider
from app.errors import ProviderError, TickerNotFound
from app.models import Article
from app.news_links import LinkResolver, host_of

BASE_URL = "https://finnhub.io/api/v1"
NEWS_WINDOW_DAYS = 30
AGGREGATOR_SOURCES = {"yahoo"}  # Finnhub's feed name, not the outlet that wrote the story
REDIRECT_HOST = "finnhub.io"
# Time for finding real publishers. With Finnhub's own 15 s timeout this stays under the
# central API's 30 s; articles not resolved in time keep Finnhub's label and link.
RESOLVE_SECONDS = 8.0
RESOLVE_ROUNDS = 4

# One identity per outlet when spreading across publishers: an unresolved 'Yahoo' label and
# a resolved 'Yahoo Finance' count as the same publisher.
PUBLISHER_KEYS = {"yahoo": "yahoo finance"}

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
    host = (host_of(url) or "").removeprefix("www.")
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


def _publisher_key(publisher: str | None) -> str | None:
    """Identity used to count articles per publisher."""
    if publisher is None:
        return None
    key = publisher.strip().lower()
    return PUBLISHER_KEYS.get(key, key)


def _needs_lookup(article: Article) -> bool:
    """Labelled with Finnhub's feed name and still pointing at Finnhub's redirect."""
    return ((article.publisher or "").lower() in AGGREGATOR_SOURCES
            and host_of(article.url) == REDIRECT_HOST)


class FinnhubProvider(OverviewProvider, NewsProvider):
    def __init__(self, api_key: str, links: LinkResolver | None = None):
        self._key = api_key
        # One resolver per provider, and main.py builds one provider, so its worker pool
        # limits redirect lookups across all requests.
        self._links = links or LinkResolver()

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
        return self._pick_with_real_publishers(valid, limit)

    def _pick_with_real_publishers(self, articles: list[Article], limit: int) -> list[Article]:
        """Spread across publishers using each article's real publisher (see app/news_links.py).
        The newest articles are resolved first; if spreading then picks one still labelled with
        Finnhub's feed name, that one is resolved and the spread redone, until every picked
        article is resolved, nothing new can be tried, or time runs out."""
        deadline = time.monotonic() + RESOLVE_SECONDS
        tried: set[int] = set()
        candidates = articles[:limit * 2]
        picked: list[Article] = []
        for _ in range(RESOLVE_ROUNDS):
            batch = [a for a in candidates if id(a) not in tried and _needs_lookup(a)]
            if batch:
                tried.update(id(a) for a in batch)
                targets = self._links.resolve([a.url for a in batch], deadline)
                for article in batch:
                    target = targets.get(article.url)
                    publisher = _publisher_from_url(target) if target else None
                    if publisher:
                        article.publisher, article.url = publisher, target
            picked = self._spread_across_publishers(articles, limit)
            candidates = picked
            if time.monotonic() >= deadline or not any(
                    id(a) not in tried and _needs_lookup(a) for a in picked):
                break
        return picked

    @staticmethod
    def _spread_across_publishers(articles: list[Article], limit: int) -> list[Article]:
        """Newest first, but no publisher fills every slot (FR-7: at least two publishers)."""
        per_publisher = max(1, limit - 1)
        picked, counts = [], {}
        for article in articles:
            if len(picked) == limit:
                break
            key = _publisher_key(article.publisher)
            if counts.get(key, 0) < per_publisher:
                picked.append(article)
                counts[key] = counts.get(key, 0) + 1
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