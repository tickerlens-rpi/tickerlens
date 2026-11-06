"""Company search and lookup over the companies listed on NYSE and NASDAQ.

Routes depend on the abstract `CompanyDirectory`, never on a concrete class,
so the bundled list used today can be swapped for a database-backed one
without touching the routes, and tests can substitute a small fixed list.
The list itself is `data/companies.csv`, built by
`scripts/build_company_list.py` from Nasdaq Trader's symbol directory.
"""

import abc
import csv
from collections.abc import Iterable
from functools import cache
from pathlib import Path

from app.models import Company

COMPANY_LIST = Path(__file__).resolve().parent / "data" / "companies.csv"


class CompanyDirectory(abc.ABC):
    """Finds listed companies by name or ticker."""

    @abc.abstractmethod
    def search(self, query: str, limit: int) -> list[Company]:
        """Returns up to `limit` companies matching `query`, best first."""

    @abc.abstractmethod
    def get(self, ticker: str) -> Company | None:
        """Returns the company with this normalized ticker, if there is one."""


class InMemoryCompanyDirectory(CompanyDirectory):
    """Searches a fixed collection of companies held in memory.

    Matches are ranked: exact ticker, ticker prefix, name prefix, a word in
    the name starting with the query, then the query anywhere in the name.
    Within a rank, bigger listings (NYSE and Nasdaq Global Select) and
    shorter names come first, so "apple" finds Apple Inc. before Apple
    Hospitality REIT.
    """

    def __init__(self, companies: Iterable[tuple[Company, int]]) -> None:
        """Indexes the companies.

        Args:
            companies: Each company with its size tier, where 0 is the
                biggest listings and larger numbers are smaller ones.
        """
        self._by_ticker: dict[str, Company] = {}
        self._entries: list[tuple[str, str, int, Company]] = []
        for company, tier in companies:
            self._by_ticker[company.ticker] = company
            name = _searchable(company.name)
            self._entries.append((company.ticker.casefold(), name, tier, company))

    def search(self, query: str, limit: int) -> list[Company]:
        """Returns up to `limit` companies matching `query`, best first."""
        needle = _searchable(query.strip().removeprefix("$"))
        if not needle:
            return []
        ticker_needle = needle.replace(".", "-")
        ranked = []
        for ticker, name, tier, company in self._entries:
            rank = _match_rank(ticker, name, needle, ticker_needle)
            if rank is not None:
                ranked.append((rank, tier, len(name), ticker, company))
        ranked.sort(key=lambda entry: entry[:4])
        return [entry[4] for entry in ranked[:limit]]

    def get(self, ticker: str) -> Company | None:
        """Returns the company with this normalized ticker, if there is one."""
        return self._by_ticker.get(ticker)


def load_companies(path: Path = COMPANY_LIST) -> list[tuple[Company, int]]:
    """Reads the company list CSV (ticker, name, exchange, size_tier)."""
    with path.open(newline="", encoding="utf-8") as file:
        return [
            (
                Company(
                    ticker=row["ticker"],
                    name=row["name"],
                    exchange=row["exchange"],
                ),
                int(row["size_tier"]),
            )
            for row in csv.DictReader(file)
        ]


@cache
def default_directory() -> CompanyDirectory:
    """The directory built from the bundled list, loaded once."""
    return InMemoryCompanyDirectory(load_companies())


def get_directory() -> CompanyDirectory:
    """FastAPI dependency; tests override it with a small fixed directory."""
    return default_directory()


def _searchable(text: str) -> str:
    """Case-folds and drops a leading "The " so "coca" finds The Coca-Cola."""
    folded = " ".join(text.casefold().split())
    return folded.removeprefix("the ")


def _match_rank(
    ticker: str, name: str, needle: str, ticker_needle: str
) -> int | None:
    """Scores one company; lower is better, None means no match."""
    if ticker == ticker_needle:
        return 0
    if ticker.startswith(ticker_needle):
        return 1
    if name.startswith(needle):
        return 2
    if f" {needle}" in f" {name}":
        return 3
    if needle in name:
        return 4
    return None
