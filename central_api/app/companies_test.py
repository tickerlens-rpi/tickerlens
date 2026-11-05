import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_company_repository
from app.main import app
from app.models import Company
from app.repositories import CompanyRepository

client = TestClient(app)


def test_search_by_ticker_puts_the_exact_match_first():
    response = client.get("/companies/search", params={"q": "AAPL"})

    assert response.status_code == 200
    assert response.json()["results"][0] == {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
    }


def test_search_by_name_lists_apple_before_apple_hospitality():
    response = client.get("/companies/search", params={"q": "apple"})

    tickers = [company["ticker"] for company in response.json()["results"]]
    assert tickers == ["AAPL", "APLE"]


def test_search_echoes_the_query():
    response = client.get("/companies/search", params={"q": "nike"})

    assert response.json()["query"] == "nike"


def test_search_with_no_matches_returns_an_empty_list():
    response = client.get("/companies/search", params={"q": "ZZZZ"})

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_respects_the_limit():
    response = client.get("/companies/search", params={"q": "a", "limit": 2})

    assert len(response.json()["results"]) == 2


@pytest.mark.parametrize(
    "params", [{}, {"q": ""}, {"q": "a", "limit": 0}, {"q": "a", "limit": 21}]
)
def test_search_rejects_invalid_parameters(params):
    response = client.get("/companies/search", params=params)

    assert response.status_code == 422


@pytest.mark.parametrize("ticker", ["NKE", "nke", "$nke"])
def test_get_company_accepts_any_spelling_of_the_ticker(ticker):
    response = client.get(f"/companies/{ticker}")

    assert response.status_code == 200
    assert response.json() == {
        "ticker": "NKE",
        "name": "Nike, Inc.",
        "exchange": "NYSE",
    }


def test_get_company_handles_tickers_with_a_dot():
    response = client.get("/companies/BRK.B")

    assert response.json()["name"] == "Berkshire Hathaway Inc."


def test_get_company_returns_404_for_an_unknown_ticker():
    response = client.get("/companies/ZZZZ")

    assert response.status_code == 404
    assert "ZZZZ" in response.json()["detail"]


def test_routes_use_whichever_repository_is_injected():
    class OneCompanyRepository(CompanyRepository):
        async def search(self, query: str, limit: int) -> list[Company]:
            return []

        async def get(self, ticker: str) -> Company | None:
            return Company(ticker=ticker, name="Stub Corp", exchange="NYSE")

    app.dependency_overrides[get_company_repository] = OneCompanyRepository
    try:
        response = client.get("/companies/ANY")
    finally:
        app.dependency_overrides.clear()

    assert response.json()["name"] == "Stub Corp"
