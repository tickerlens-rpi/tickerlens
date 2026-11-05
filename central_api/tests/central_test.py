"""Central API tests. Offline, except the Postgres ones: set TEST_DATABASE_URL to run those
(they drop and recreate the `cache` table). Run from central_api:  python -m pytest -v
"""
import os
import time
import httpx
import pytest
from fastapi.testclient import TestClient
from app import clients, config, db
from app.main import app

NOW = "2026-11-04T12:00:00Z"
DATA = {
    "overview": {"ticker": "AAPL", "name": "Apple Inc", "price": 231.45, "last_updated": NOW},
    "prices": {"ticker": "AAPL", "range": "1M", "points": [{"date": "2026-11-03", "close": 230.0}], "last_updated": NOW},
    "news": {"ticker": "AAPL", "articles": [], "last_updated": NOW},
}
URLS = {"overview": "/companies/AAPL/overview", "prices": "/companies/AAPL/prices?range=1M",
        "news": "/companies/AAPL/news?limit=5"}


class World:
    """Fake database, scraper and scheduler, so a test only describes the situation."""

    def __init__(self):
        self.rows = {}        # (kind, ticker, param) -> (payload, fetched_at)
        self.fetches = []     # what was asked of the scraper
        self.told = []        # tickers reported to the scheduler
        self.scraper_error = None

    def age(self, kind, ticker, param, seconds):
        """Pretend the stored row was fetched `seconds` ago."""
        payload, _ = self.rows[(kind, ticker, param)]
        self.rows[(kind, ticker, param)] = (payload, time.time() - seconds)


@pytest.fixture
def world(monkeypatch):
    w = World()

    def fetch(kind, ticker, param):
        w.fetches.append((kind, ticker, param))
        if w.scraper_error:
            raise w.scraper_error
        return DATA[kind]

    monkeypatch.setattr(db, "get", lambda kind, ticker, param: w.rows.get((kind, ticker, param)))
    monkeypatch.setattr(db, "put", lambda kind, ticker, param, payload: w.rows.__setitem__((kind, ticker, param), (payload, time.time())))
    monkeypatch.setattr(clients, "fetch", fetch)
    monkeypatch.setattr(clients, "tell_scheduler", w.told.append)
    return w


@pytest.fixture
def client(world):
    return TestClient(app)


# ======================= the frontend's endpoints =======================

def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("kind", ["overview", "prices", "news"])
def test_miss_then_hit(client, world, kind):
    first, second = client.get(URLS[kind]), client.get(URLS[kind])
    assert first.status_code == 200 and first.headers["X-Cache"] == "MISS"
    assert second.headers["X-Cache"] == "HIT" and second.json() == first.json()
    assert first.json()["ticker"] == "AAPL"
    assert len(world.fetches) == 1  # the second answer came from the database


def test_defaults_are_1m_and_5_articles(client, world):
    client.get("/companies/AAPL/prices"); client.get("/companies/AAPL/news")
    assert world.fetches == [("prices", "AAPL", "1M"), ("news", "AAPL", "5")]


def test_each_parameter_is_stored_separately(client, world):
    for url in ("/companies/AAPL/prices?range=1W", "/companies/AAPL/prices?range=1Y", "/companies/AAPL/prices?range=1W"):
        client.get(url)
    assert world.fetches == [("prices", "AAPL", "1W"), ("prices", "AAPL", "1Y")]


@pytest.mark.parametrize(("raw", "clean"), [("$aapl", "AAPL"), (" nke ", "NKE"), ("brk.b", "BRK-B")])
def test_tickers_are_normalized(client, world, raw, clean):
    client.get(f"/companies/{raw}/overview")
    assert world.fetches == [("overview", clean, None)] and world.told == [clean]


@pytest.mark.parametrize("url", ["/companies/AAPL/prices?range=9Y", "/companies/AAPL/prices?range=1w",
                                 "/companies/AAPL/news?limit=0", "/companies/AAPL/news?limit=21"])
def test_bad_parameters_return_422_and_touch_nothing(client, world, url):
    assert client.get(url).status_code == 422 and world.fetches == [] and world.told == []


# ======================= out of date =======================

@pytest.mark.parametrize(("kind", "limit"), [("overview", 900), ("prices", 900), ("news", 3600)])
def test_data_goes_out_of_date_after_its_limit(client, world, kind, limit):
    key = {"overview": ("overview", "AAPL", None), "prices": ("prices", "AAPL", "1M"), "news": ("news", "AAPL", "5")}[kind]
    client.get(URLS[kind])
    world.age(*key, limit - 5)
    assert client.get(URLS[kind]).headers["X-Cache"] == "HIT"
    world.age(*key, limit + 5)
    assert client.get(URLS[kind]).headers["X-Cache"] == "MISS"
    assert len(world.fetches) == 2


# ======================= scraper trouble =======================

def test_scraper_down_with_no_data_is_502(client, world):
    world.scraper_error = clients.Unavailable("down")
    assert client.get(URLS["overview"]).status_code == 502
    assert world.told == ["AAPL"]  # the scheduler is told so it can fill the data in later


def test_scraper_down_with_old_data_serves_it_as_stale(client, world):
    client.get(URLS["overview"])
    world.age("overview", "AAPL", None, 5000)
    world.scraper_error = clients.Unavailable("down")
    r = client.get(URLS["overview"])
    assert r.status_code == 200 and r.headers["X-Cache"] == "STALE" and r.json()["price"] == 231.45


def test_unknown_ticker_is_404_and_not_stored_or_reported(client, world):
    world.scraper_error = clients.NotFound("ZZZZ")
    assert client.get("/companies/ZZZZ/overview").status_code == 404
    assert world.rows == {} and world.told == []


@pytest.mark.parametrize("repeat", [False, True])
def test_every_search_is_reported_to_the_scheduler(client, world, repeat):
    client.get(URLS["overview"])
    if repeat:
        world.told.clear()
        client.get(URLS["overview"])  # a HIT is still a search
    assert world.told == ["AAPL"]


# ======================= database trouble =======================

def test_broken_database_does_not_break_the_api(monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none")
    monkeypatch.setattr(clients, "fetch", lambda kind, ticker, param: DATA[kind])
    monkeypatch.setattr(clients, "tell_scheduler", lambda ticker: None)
    assert db.get("overview", "AAPL", None) is None
    db.put("overview", "AAPL", None, DATA["overview"])  # must not raise
    db.create_tables()                                    # must not raise
    r = TestClient(app).get(URLS["overview"])
    assert r.status_code == 200 and r.headers["X-Cache"] == "MISS"


# ======================= scraper and scheduler clients =======================

def test_fetch_builds_the_right_requests(monkeypatch):
    seen = []

    def fake_get(url, params=None, timeout=None):
        seen.append((url, params))
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(httpx, "get", fake_get)
    clients.fetch("overview", "AAPL", None); clients.fetch("prices", "AAPL", "1Y"); clients.fetch("news", "AAPL", "7")
    base = config.SCRAPER_URL
    assert seen == [(f"{base}/companies/AAPL/overview", {}), (f"{base}/companies/AAPL/prices", {"range": "1Y"}),
                    (f"{base}/companies/AAPL/news", {"limit": "7"})]


@pytest.mark.parametrize(("response", "error"), [
    (httpx.Response(404), clients.NotFound), (httpx.Response(502), clients.Unavailable),
    (httpx.Response(500), clients.Unavailable), (httpx.Response(200, text="<html>"), clients.Unavailable),
    (httpx.ConnectError("refused"), clients.Unavailable), (httpx.ReadTimeout("slow"), clients.Unavailable),
])
def test_fetch_maps_failures(monkeypatch, response, error):
    def fake_get(*a, **k):
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(error):
        clients.fetch("overview", "AAPL", None)


class InlineThread:
    """Runs the work immediately, so the test does not have to wait for a background thread."""

    def __init__(self, target, args, daemon):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


@pytest.fixture
def scheduler(monkeypatch):
    posts = []
    clients._last_told.clear()
    monkeypatch.setattr(clients.threading, "Thread", InlineThread)
    monkeypatch.setattr(httpx, "post", lambda url, timeout=None: posts.append(url) or httpx.Response(200, request=httpx.Request("POST", url)))
    return posts


def test_scheduler_is_told_once_a_minute_per_ticker(scheduler, monkeypatch):
    clients.tell_scheduler("AAPL"); clients.tell_scheduler("AAPL"); clients.tell_scheduler("NKE")
    assert scheduler == [f"{config.SCHEDULER_URL}/watch/AAPL", f"{config.SCHEDULER_URL}/watch/NKE"]
    clients._last_told["AAPL"] -= 61
    clients.tell_scheduler("AAPL")
    assert len(scheduler) == 3


@pytest.mark.parametrize("failure", [httpx.ConnectError("down"), httpx.Response(500)])
def test_scheduler_trouble_is_swallowed_and_retried_next_search(scheduler, monkeypatch, failure):
    def post(url, timeout=None):
        if isinstance(failure, Exception):
            raise failure
        return httpx.Response(500, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", post)
    clients.tell_scheduler("AAPL")  # must not raise
    assert "AAPL" not in clients._last_told  # so the next search tries again


# ======================= real Postgres =======================

DB_URL = os.getenv("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not DB_URL, reason="set TEST_DATABASE_URL to run the Postgres tests")


@pytest.fixture
def pg(monkeypatch):
    import psycopg
    monkeypatch.setattr(config, "DATABASE_URL", DB_URL)
    with psycopg.connect(DB_URL) as conn:
        conn.execute("DROP TABLE IF EXISTS cache")
    db.create_tables()


@needs_db
def test_postgres_store_and_read(pg):
    assert db.get("overview", "AAPL", None) is None
    before = time.time()
    db.put("overview", "AAPL", None, DATA["overview"])
    payload, fetched_at = db.get("overview", "AAPL", None)
    assert payload == DATA["overview"] and before <= fetched_at <= time.time()


@needs_db
def test_postgres_replaces_and_keeps_parameters_apart(pg):
    db.put("prices", "AAPL", "1W", {"a": 1}); db.put("prices", "AAPL", "1Y", {"b": 2}); db.put("prices", "AAPL", "1W", {"c": 3})
    assert db.get("prices", "AAPL", "1W")[0] == {"c": 3} and db.get("prices", "AAPL", "1Y")[0] == {"b": 2}


@needs_db
def test_postgres_whole_flow(pg, monkeypatch):
    fetched = []
    monkeypatch.setattr(clients, "fetch", lambda kind, ticker, param: fetched.append(1) or DATA[kind])
    monkeypatch.setattr(clients, "tell_scheduler", lambda ticker: None)
    c = TestClient(app)
    assert c.get(URLS["overview"]).headers["X-Cache"] == "MISS"
    assert c.get(URLS["overview"]).headers["X-Cache"] == "HIT"
    assert len(fetched) == 1