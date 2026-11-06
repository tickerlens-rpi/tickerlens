"""Real HTTP tests against a RUNNING API (default http://localhost:8001). Uses the real providers.

Start the server first (Docker or uvicorn), then from scrapper_api:
  python -m pytest tests/test_deployment.py -v -s
Use another address with:  $env:API_URL="http://localhost:8000"

The server needs FINNHUB_API_KEY. Prices come from Yahoo Finance and need no key.
Cost: about 9 Finnhub calls (limit 60/minute) and 1 Yahoo download (cached for 5 minutes).
"""
import json
import os
import httpx
import pytest

BASE_URL = os.getenv("API_URL", "http://localhost:8001")
client = httpx.Client(base_url=BASE_URL, timeout=30)


def server_is_up():
    try:
        return client.get("/health").status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(not server_is_up(), reason=f"no API running at {BASE_URL}")


def show_prices(body):
    points = body["points"]
    print(f"  range={body['range']}  points={len(points)}")
    print(f"  first: {points[0]}")
    print(f"  last:  {points[-1]}")


# ---------- /health ----------

def test_health():
    r = client.get("/health")
    print(f"\nGET /health -> {r.status_code} {r.json()}")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------- /companies/{ticker}/overview ----------

def test_overview():
    r = client.get("/companies/AAPL/overview")
    print(f"\nGET /companies/AAPL/overview -> {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    assert r.status_code == 200
    o = r.json()
    assert o["ticker"] == "AAPL"
    assert "Apple" in o["name"]
    assert o["exchange"] == "NASDAQ"
    assert o["price"] > 0
    assert o["market_cap"] > 100_000_000_000
    assert o["pe_ratio"] is not None and o["pe_ratio"] > 0
    assert o["eps"] is not None
    assert o["revenue_growth_pct"] is not None
    assert o["change_1d_pct"] is not None and -50 < o["change_1d_pct"] < 50
    assert o["change_1w_pct"] is not None and -50 < o["change_1w_pct"] < 50
    assert o["last_updated"]


def test_overview_lowercase_ticker_works():
    r = client.get("/companies/aapl/overview")
    print(f"\nGET /companies/aapl/overview -> {r.status_code}, ticker={r.json().get('ticker')}")
    assert r.status_code == 200
    assert r.json()["ticker"] == "AAPL"


def test_overview_unknown_ticker_is_404():
    r = client.get("/companies/ZZZZ/overview")
    print(f"\nGET /companies/ZZZZ/overview -> {r.status_code} {r.json()}")
    assert r.status_code == 404


# ---------- /companies/{ticker}/prices ----------

def test_prices_1w():
    r = client.get("/companies/AAPL/prices?range=1W")
    print(f"\nGET /companies/AAPL/prices?range=1W -> {r.status_code}")
    assert r.status_code == 200
    body = r.json()
    print("  all points:", body["points"])
    assert body["ticker"] == "AAPL"
    assert body["range"] == "1W"
    assert len(body["points"]) == 5
    assert all(p["close"] > 0 for p in body["points"])
    dates = [p["date"] for p in body["points"]]
    assert dates == sorted(dates)


def test_prices_1m():
    r = client.get("/companies/AAPL/prices?range=1M")
    print(f"\nGET /companies/AAPL/prices?range=1M -> {r.status_code}")
    body = r.json()
    show_prices(body)
    assert body["range"] == "1M"
    assert len(body["points"]) == 21


def test_prices_1y():
    r = client.get("/companies/AAPL/prices?range=1Y")
    print(f"\nGET /companies/AAPL/prices?range=1Y -> {r.status_code}")
    body = r.json()
    show_prices(body)
    assert body["range"] == "1Y"
    assert len(body["points"]) == 52


def test_prices_5y():
    r = client.get("/companies/AAPL/prices?range=5Y")
    print(f"\nGET /companies/AAPL/prices?range=5Y -> {r.status_code}")
    body = r.json()
    show_prices(body)
    assert body["range"] == "5Y"
    assert len(body["points"]) == 260


def test_prices_bad_range_is_422():
    r1 = client.get("/companies/AAPL/prices?range=9Y")
    r2 = client.get("/companies/AAPL/prices?range=1w")
    print(f"\nprices?range=9Y -> {r1.status_code}, prices?range=1w -> {r2.status_code}")
    assert r1.status_code == 422
    assert r2.status_code == 422


# ---------- /companies/{ticker}/news ----------

def test_news():
    r = client.get("/companies/AAPL/news?limit=5")
    print(f"\nGET /companies/AAPL/news?limit=5 -> {r.status_code}")
    assert r.status_code == 200
    articles = r.json()["articles"]
    for a in articles:
        print(f"  [{a['publisher']}] {a['published_at']}  {a['headline']}")
        print(f"      {a['url']}")
    assert 1 <= len(articles) <= 5
    for a in articles:
        assert a["headline"].strip() != ""
        assert a["url"].startswith("http")
        assert a["publisher"]
        assert a["published_at"] is not None


def test_news_limit_one_returns_one_article():
    articles = client.get("/companies/AAPL/news?limit=1").json()["articles"]
    print(f"\nnews?limit=1 -> {len(articles)} article: {articles[0]['headline']}")
    assert len(articles) == 1


def test_news_bad_limit_is_422():
    codes = [client.get(f"/companies/AAPL/news?limit={x}").status_code for x in ("0", "21", "abc")]
    print(f"\nnews limit=0, 21, abc -> {codes}")
    assert codes == [422, 422, 422]