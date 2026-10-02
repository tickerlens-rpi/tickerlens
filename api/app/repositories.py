"""Where the API gets company data from.

Routes depend on the abstract `CompanyRepository`, never on a concrete class,
so the in-memory version used today can be replaced by a database-backed one
without touching the routes, and tests can substitute their own.
"""

import abc
from collections.abc import Iterable

from app.models import Company
from app.tickers import normalize_ticker


class CompanyRepository(abc.ABC):
    """Looks up listed companies."""

    @abc.abstractmethod
    async def search(self, query: str, limit: int) -> list[Company]:
        """Returns up to `limit` companies matching `query`, best first."""

    @abc.abstractmethod
    async def get(self, ticker: str) -> Company | None:
        """Returns the company with this ticker, or None if there is none."""


class InMemoryCompanyRepository(CompanyRepository):
    """Serves companies from a fixed collection held in memory."""

    def __init__(self, companies: Iterable[Company]) -> None:
        """Indexes `companies` by ticker."""
        self._by_ticker = {company.ticker: company for company in companies}

    async def search(self, query: str, limit: int) -> list[Company]:
        """Returns up to `limit` companies matching `query`, best first."""
        needle = query.strip().removeprefix("$").casefold()
        if not needle:
            return []
        ranked = []
        for company in self._by_ticker.values():
            rank = _match_rank(company, needle)
            if rank is not None:
                ranked.append((rank, company.ticker, company))
        ranked.sort(key=lambda entry: entry[:2])
        return [company for _, _, company in ranked[:limit]]

    async def get(self, ticker: str) -> Company | None:
        """Returns the company with this ticker, or None if there is none."""
        return self._by_ticker.get(normalize_ticker(ticker))


def _match_rank(company: Company, needle: str) -> int | None:
    """Scores how well a company matches; lower is better, None is no match."""
    ticker = company.ticker.casefold()
    name = company.name.casefold()
    if ticker == needle:
        return 0
    if ticker.startswith(needle):
        return 1
    if name.startswith(needle):
        return 2
    if needle in name:
        return 3
    return None
