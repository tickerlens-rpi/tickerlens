"""Tests for company search and lookup."""

import pytest
from fastapi.testclient import TestClient

from app.companies import (
    InMemoryCompanyDirectory,
    get_directory,
    load_companies,
)
from app.main import app
from app.models import Company


def _company(ticker, name, exchange="NASDAQ", tier=0):
    return Company(ticker=ticker, name=name, exchange=exchange), tier


DIRECTORY = InMemoryCompanyDirectory(
    [
        _company("AAPL", "Apple Inc."),
        _company("APLE", "Apple Hospitality REIT, Inc.", "NYSE"),
        _company("MLP", "Maui Land & Pineapple Company, Inc.", "NYSE"),
        _company("KO", "The Coca-Cola Company", "NYSE"),
        _company("COKE", "Coca-Cola Consolidated, Inc."),
        _company("GM", "General Motors Company", "NYSE"),
        _company("BRK-B", "Berkshire Hathaway Inc.", "NYSE"),
        _company("MSFT", "Microsoft Corporation"),
        _company("MCRO", "Microtiny Corp.", tier=2),
    ]
)


def _tickers(companies):
    return [company.ticker for company in companies]


class TestInMemoryCompanyDirectory:
    def test_exact_ticker_comes_first(self):
        assert _tickers(DIRECTORY.search("aapl", 5))[0] == "AAPL"

    def test_name_prefix_beats_a_word_inside_another_name(self):
        assert _tickers(DIRECTORY.search("apple", 5)) == ["AAPL", "APLE", "MLP"]

    def test_bigger_listings_come_first_within_a_rank(self):
        assert _tickers(DIRECTORY.search("micro", 5)) == ["MSFT", "MCRO"]

    def test_ignores_a_leading_the_in_names(self):
        assert _tickers(DIRECTORY.search("coca", 5)) == ["KO", "COKE"]

    def test_matches_a_later_word_in_the_name(self):
        assert _tickers(DIRECTORY.search("motors", 5)) == ["GM"]

    def test_accepts_dollar_signs_and_dotted_share_classes(self):
        assert _tickers(DIRECTORY.search("$brk.b", 5)) == ["BRK-B"]

    def test_respects_the_limit(self):
        assert len(DIRECTORY.search("a", 2)) == 2

    def test_returns_nothing_for_blank_or_unknown_queries(self):
        assert DIRECTORY.search("   ", 5) == []
        assert DIRECTORY.search("zzzz", 5) == []

    def test_gets_a_company_by_ticker(self):
        assert DIRECTORY.get("KO").name == "The Coca-Cola Company"
        assert DIRECTORY.get("NOPE") is None


class TestBundledList:
    def test_has_the_big_names_on_both_exchanges(self):
        companies = {company.ticker: company for company, _ in load_companies()}
        assert len(companies) > 4000
        assert companies["AAPL"].exchange == "NASDAQ"
        assert companies["NKE"].exchange == "NYSE"
        assert companies["BRK-B"].name == "Berkshire Hathaway Inc."

    def test_has_no_funds_warrants_or_preferred_shares(self):
        tickers = {company.ticker for company, _ in load_companies()}
        assert "SPY" not in tickers  # an ETF
        assert not any("$" in ticker or "=" in ticker for ticker in tickers)


@pytest.fixture
def client():
    app.dependency_overrides[get_directory] = lambda: DIRECTORY
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestEndpoints:
    def test_search_returns_matches_best_first(self, client):
        response = client.get("/companies/search", params={"q": "apple"})
        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "apple"
        assert [c["ticker"] for c in body["results"]] == ["AAPL", "APLE", "MLP"]
        assert body["results"][0] == {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "exchange": "NASDAQ",
        }

    def test_search_with_no_matches_is_an_empty_list(self, client):
        response = client.get("/companies/search", params={"q": "zzzz"})
        assert response.status_code == 200
        assert response.json()["results"] == []

    def test_search_checks_its_parameters(self, client):
        assert client.get("/companies/search").status_code == 422
        assert client.get("/companies/search?q=").status_code == 422
        too_many = client.get("/companies/search?q=a&limit=50")
        assert too_many.status_code == 422

    def test_search_is_not_mistaken_for_a_ticker(self, client):
        # /companies/search must not be read as the company "SEARCH".
        response = client.get("/companies/search", params={"q": "ko"})
        assert "results" in response.json()

    def test_looks_up_a_company_with_a_forgiving_ticker(self, client):
        response = client.get("/companies/brk.b")
        assert response.status_code == 200
        assert response.json()["ticker"] == "BRK-B"

    def test_unknown_company_is_404(self, client):
        response = client.get("/companies/NOPE")
        assert response.status_code == 404

    def test_malformed_ticker_is_422(self, client):
        assert client.get("/companies/not a ticker!").status_code == 422
