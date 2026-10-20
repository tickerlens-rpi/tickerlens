import asyncio

from app.models import Company
from app.repositories import InMemoryCompanyRepository

ACME = Company(ticker="ACME", name="Acme Corporation", exchange="NYSE")
ACORN = Company(ticker="AC", name="Acorn Foods", exchange="NASDAQ")
ZETA = Company(ticker="ZT", name="Zeta Acme Holdings", exchange="NYSE")

repository = InMemoryCompanyRepository([ZETA, ACME, ACORN])


def search(query: str, limit: int = 10) -> list[Company]:
    return asyncio.run(repository.search(query, limit))


def test_search_ranks_ticker_matches_above_name_matches():
    # "ac" is AC's ticker exactly, a prefix of ACME's ticker, and only
    # appears inside ZT's name.
    assert search("ac") == [ACORN, ACME, ZETA]


def test_search_ignores_case_whitespace_and_a_leading_dollar_sign():
    assert search("  $acme ") == [ACME, ZETA]


def test_search_with_blank_input_returns_nothing():
    assert search("   ") == []


def test_search_stops_at_the_limit():
    assert search("ac", limit=1) == [ACORN]


def test_get_normalizes_the_ticker():
    assert asyncio.run(repository.get(" $acme")) == ACME


def test_get_returns_none_for_an_unknown_ticker():
    assert asyncio.run(repository.get("NOPE")) is None
