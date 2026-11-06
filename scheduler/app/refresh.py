"""The scheduler's work: ask the scraper for fresh data and store it, for every ticker on the watchlist."""
import logging
import time
import httpx
from app import config, db

log = logging.getLogger("uvicorn.error")


class NotFound(Exception):
    """The scraper says this ticker does not exist."""


class Unavailable(Exception):
    """The scraper or one of its data providers failed."""


def fetch(kind: str, ticker: str, param: str | None) -> dict:
    """Ask the scraper for fresh data. `kind` is overview, prices or news."""
    query = {"prices": {"range": param}, "news": {"limit": param}}.get(kind, {})
    try:
        response = httpx.get(f"{config.SCRAPER_URL}/companies/{ticker}/{kind}", params=query, timeout=30)
        if response.status_code == 404:
            raise NotFound(ticker)
        if response.status_code != 200:
            raise Unavailable(f"scraper returned HTTP {response.status_code}")
        return response.json()
    except (httpx.HTTPError, ValueError) as e:  # network trouble or a body that is not JSON
        raise Unavailable(type(e).__name__) from None


_failed_at: dict[tuple, float] = {}  # (ticker, kind, param) -> last failure


def _overview_first(job: tuple[str, str | None]) -> tuple:
    """Sort key: the overview decides if a ticker is real, so ask it first."""
    kind, param = job
    return (kind != "overview", kind, param or "")


def run_once() -> dict:
    """One pass: drop tickers not searched for a week, then refresh whatever is about to go out of date."""
    now = time.time()
    counts = {"expired": len(db.drop_expired(now - config.WATCH_SECONDS)), "refreshed": 0, "failed": 0}

    tickers = list(db.watchlist())
    stored = db.stored_times(tickers)
    for ticker in tickers:
        jobs = set(config.DEFAULT_JOBS) | set(stored[ticker])
        for kind, param in sorted(jobs, key=_overview_first):
            fetched_at = stored[ticker].get((kind, param))
            if fetched_at is not None and now - fetched_at < config.INTERVAL[kind] - config.TICK_SECONDS:
                continue  # still fresh
            if now - _failed_at.get((ticker, kind, param), 0) < config.FAILURE_BACKOFF_SECONDS:
                continue  # failed recently, wait

            try:
                db.put(kind, ticker, param, fetch(kind, ticker, param))
            except NotFound:
                if kind == "overview":
                    db.forget(ticker)  # not a real ticker: stop watching it
                    break
                # Other kinds can be missing for a real company (say a stock
                # Yahoo has no prices for), so keep the ticker and its data.
                log.warning("No %s for %s %s", kind, ticker, param)
                _failed_at[(ticker, kind, param)] = time.time()
                counts["failed"] += 1
            except Unavailable as e:
                log.warning("Refresh failed for %s %s %s: %s", kind, ticker, param, e)
                _failed_at[(ticker, kind, param)] = time.time()
                counts["failed"] += 1
            else:
                _failed_at.pop((ticker, kind, param), None)
                counts["refreshed"] += 1
            time.sleep(config.PAUSE_SECONDS)  # stay under the scraper's provider rate limits
    return counts