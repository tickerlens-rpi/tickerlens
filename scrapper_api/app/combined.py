"""Routes each request to the provider whose free tier supports it.

Finnhub: overview figures and news. Yahoo Finance (yfinance): price history.
"""
from app.abstract_classes import MarketDataProvider, NewsProvider, PriceProvider
from app.finnhub import FinnhubProvider
from app.models import Article, PricePoint


class CombinedProvider(MarketDataProvider, NewsProvider):
    def __init__(self, fundamentals: FinnhubProvider, prices: PriceProvider):
        self._fundamentals = fundamentals
        self._prices = prices

    def get_overview(self, ticker: str) -> dict:
        return self._fundamentals.get_overview(ticker)

    def get_prices(self, ticker: str, range_: str) -> list[PricePoint]:
        return self._prices.get_prices(ticker, range_)

    def get_news(self, ticker: str, limit: int) -> list[Article]:
        return self._fundamentals.get_news(ticker, limit)