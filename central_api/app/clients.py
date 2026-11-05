"""Calls to the other two containers: the scraper and the scheduler."""
import logging
import threading
import time
import httpx
from app import config

log = logging.getLogger("uvicorn.error")


class NotFoundError(Exception):
    """The scraper says this ticker does not exist."""


class UnavailableError(Exception):
    """The scraper or one of its data providers failed."""


def fetch(kind: str, ticker: str, param: str | None) -> dict:
    """Asks the scraper for fresh data.

    Args:
        kind: overview, prices or news.
        ticker: A validated, normalized ticker.
        param: The price range or news limit, or None for an overview.

    Returns:
        The scraper's JSON answer.

    Raises:
        NotFoundError: The ticker does not exist.
        UnavailableError: The scraper or a data provider failed.
    """
    query = {"prices": {"range": param}, "news": {"limit": param}}.get(kind, {})
    url = f"{config.SCRAPER_URL}/companies/{ticker}/{kind}"
    try:
        response = httpx.get(url, params=query, timeout=30)
        if response.status_code == 404:
            raise NotFoundError(ticker)
        if response.status_code != 200:
            raise UnavailableError(f"scraper returned {response.status_code}")
        return response.json()
    except (httpx.HTTPError, ValueError) as e:  # network trouble or bad JSON
        raise UnavailableError(type(e).__name__) from None


_last_told: dict[str, float] = {}


def tell_scheduler(ticker: str) -> None:
    """Reports "this ticker was just searched" to the scheduler.

    Runs in the background, and at most once a minute per ticker.
    """
    now = time.time()
    if now - _last_told.get(ticker, 0) < config.NOTIFY_EVERY_SECONDS:
        return
    _last_told[ticker] = now
    threading.Thread(target=_post, args=(ticker,), daemon=True).start()


def _post(ticker: str) -> None:
    try:
        url = f"{config.SCHEDULER_URL}/watch/{ticker}"
        httpx.post(url, timeout=5).raise_for_status()
    except httpx.HTTPError:
        log.warning("Could not tell the scheduler about %s", ticker)
        _last_told.pop(ticker, None)  # try again on the next search
