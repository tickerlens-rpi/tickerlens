"""Provider interfaces. To change a data source, write a new adapter that implements one of these."""
from abc import ABC, abstractmethod
from app.models import Article, PricePoint


class OverviewProvider(ABC):
    @abstractmethod
    def get_overview(self, ticker: str) -> dict:
        """Return the fields of Overview (everything except last_updated)."""


class PriceProvider(ABC):
    @abstractmethod
    def get_prices(self, ticker: str, range_: str) -> list[PricePoint]:
        """range_ is one of 1W, 1M, 1Y, 5Y. Points are oldest first."""


class MarketDataProvider(OverviewProvider, PriceProvider):
    """Overview figures and price history together (what the API's endpoints need)."""


class NewsProvider(ABC):
    @abstractmethod
    def get_news(self, ticker: str, limit: int) -> list[Article]:
        """Newest articles first, at most `limit`."""
