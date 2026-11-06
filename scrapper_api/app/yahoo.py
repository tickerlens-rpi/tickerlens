"""Yahoo Finance price history via the yfinance library (no API key needed).

One download of 5 years of daily closes serves all four chart ranges:
  1W = last 5 daily closes      1M = last 21 daily closes
  1Y = last 52 weekly closes    5Y = last 260 weekly closes
yfinance is unofficial: Yahoo can change or rate-limit it without notice. Results are kept
in memory for a few minutes so a burst of range requests costs one Yahoo call, and the last
good copy is served if Yahoo fails.
"""
import time
from datetime import date

import yfinance as yf

from app.abstract_classes import PriceProvider
from app.errors import ProviderError, TickerNotFound
from app.models import PricePoint

DAILY_RANGES = {"1W": 5, "1M": 21}
WEEKLY_RANGES = {"1Y": 52, "5Y": 260}
CACHE_SECONDS = 300


def _weekly(closes: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """Last close of each ISO week, oldest first (keeps the real trading date)."""
    last_in_week: dict[tuple[int, int], tuple[str, float]] = {}
    for day, close in closes:
        year, week, _ = date.fromisoformat(day).isocalendar()
        last_in_week[(year, week)] = (day, close)
    return list(last_in_week.values())


class YahooPriceProvider(PriceProvider):
    def __init__(self, cache_seconds: int = CACHE_SECONDS):
        self._ttl = cache_seconds
        self._cache: dict[str, tuple[float, list[tuple[str, float]]]] = {}

    def get_prices(self, ticker: str, range_: str) -> list[PricePoint]:
        closes = self._closes(ticker)
        if range_ in WEEKLY_RANGES:
            window = _weekly(closes)[-WEEKLY_RANGES[range_]:]
        else:
            window = closes[-DAILY_RANGES[range_]:]
        return [PricePoint(date=d, close=c) for d, c in window]

    def _closes(self, ticker: str) -> list[tuple[str, float]]:
        hit = self._cache.get(ticker)
        if hit and time.time() - hit[0] < self._ttl:
            return hit[1]
        try:
            closes = self._download(ticker)
        except ProviderError:
            if hit:  # Yahoo is failing: serve the last good copy
                return hit[1]
            raise
        self._cache[ticker] = (time.time(), closes)
        return closes

    def _download(self, ticker: str) -> list[tuple[str, float]]:  # overridden in tests
        try:
            frame = yf.Ticker(ticker).history(period="5y", interval="1d", auto_adjust=False)
        except yf.exceptions.YFRateLimitError:
            raise ProviderError("Yahoo rate limit reached") from None
        except Exception as e:
            raise ProviderError(f"Yahoo request failed ({type(e).__name__})") from None
        return self._parse_frame(frame, ticker)

    @staticmethod
    def _parse_frame(frame, ticker: str) -> list[tuple[str, float]]:
        if frame is None or len(frame) == 0:
            raise TickerNotFound(ticker)  # yfinance returns an empty table for unknown symbols
        try:
            closes = frame["Close"].dropna()
            result = [(day.strftime("%Y-%m-%d"), round(float(c), 2)) for day, c in closes.items()]
        except (KeyError, TypeError, ValueError, AttributeError):
            raise ProviderError("Unexpected Yahoo price data") from None
        if not result:
            raise ProviderError("Yahoo returned no prices")
        return result