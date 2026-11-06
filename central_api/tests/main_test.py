"""Tests for the endpoints, with a fake database, scraper and scheduler."""
import time
import pytest
from fastapi.testclient import TestClient
from app import clients, config, db
from app.main import app

NOW = "2026-11-04T12:00:00Z"
DATA = {
    "overview": {
        "ticker": "AAPL",
        "name": "Apple Inc",
        "price": 231.45,
        "last_updated": NOW,
    },
    "prices": {
        "ticker": "AAPL",
        "range": "1M",
        "points": [{"date": "2026-11-03", "close": 230.0}],
        "last_updated": NOW,
    },
    "news": {"ticker": "AAPL", "articles": [], "last_updated": NOW},
}
URLS = {
    "overview": "/companies/AAPL/overview",
    "prices": "/companies/AAPL/prices?range=1M",
    "news": "/companies/AAPL/news?limit=5",
}
KEYS = {
    "overview": ("overview", "AAPL", None),
    "prices": ("prices", "AAPL", "1M"),
    "news": ("news", "AAPL", "5"),
}


class World:
    """A fake database, scraper and scheduler for one test situation."""

    def __init__(self):
        self.rows = {}  # (kind, ticker, param) -> (payload, fetched_at)
        self.fetches = []  # what was asked of the scraper
        self.told = []  # tickers reported to the scheduler
        self.scraper_error = None

    def age(self, key, seconds):
        """Pretends the stored row was fetched `seconds` ago."""
        payload, _ = self.rows[key]
        self.rows[key] = (payload, time.time() - seconds)


@pytest.fixture
def world(monkeypatch):
    w = World()

    def fetch(kind, ticker, param):
        w.fetches.append((kind, ticker, param))
        if w.scraper_error:
            raise w.scraper_error
        return DATA[kind]

    def put(kind, ticker, param, payload):
        w.rows[(kind, ticker, param)] = (payload, time.time())

    monkeypatch.setattr(db, "get", lambda *key: w.rows.get(key))
    monkeypatch.setattr(db, "put", put)
    monkeypatch.setattr(clients, "fetch", fetch)
    monkeypatch.setattr(clients, "tell_scheduler", w.told.append)
    return w


@pytest.fixture
def client(world):
    return TestClient(app)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("kind", ["overview", "prices", "news"])
def test_miss_then_hit(client, world, kind):
    first, second = client.get(URLS[kind]), client.get(URLS[kind])
    assert first.status_code == 200 and first.headers["X-Cache"] == "MISS"
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == first.json()
    assert first.json()["ticker"] == "AAPL"
    assert len(world.fetches) == 1  # the second answer came from the database


def test_defaults_are_1m_and_5_articles(client, world):
    client.get("/companies/AAPL/prices")
    client.get("/companies/AAPL/news")
    assert world.fetches == [("prices", "AAPL", "1M"), ("news", "AAPL", "5")]


def test_each_parameter_is_stored_separately(client, world):
    for rng in ("1W", "1Y", "1W"):
        client.get(f"/companies/AAPL/prices?range={rng}")
    assert world.fetches == [("prices", "AAPL", "1W"), ("prices", "AAPL", "1Y")]


@pytest.mark.parametrize(
    ("raw", "clean"), [("$aapl", "AAPL"), (" nke ", "NKE"), ("brk.b", "BRK-B")]
)
def test_tickers_are_normalized(client, world, raw, clean):
    client.get(f"/companies/{raw}/overview")
    assert world.fetches == [("overview", clean, None)]
    assert world.told == [clean]


@pytest.mark.parametrize(
    "raw",
    ["AAPL%3Fx%3D1", "A%20B", "%24", "-AAPL", "TOOLONGTICKER", "X" * 3000],
)
def test_junk_tickers_are_rejected_before_anything_happens(client, world, raw):
    for kind in ("overview", "prices", "news"):
        assert client.get(f"/companies/{raw}/{kind}").status_code == 422
    assert world.fetches == [] and world.told == [] and world.rows == {}


@pytest.mark.parametrize(
    "url",
    [
        "/companies/AAPL/prices?range=9Y",
        "/companies/AAPL/prices?range=1w",
        "/companies/AAPL/news?limit=0",
        "/companies/AAPL/news?limit=21",
    ],
)
def test_bad_parameters_return_422_and_touch_nothing(client, world, url):
    assert client.get(url).status_code == 422
    assert world.fetches == [] and world.told == []


@pytest.mark.parametrize(
    ("kind", "limit"), [("overview", 900), ("prices", 900), ("news", 3600)]
)
def test_data_goes_out_of_date_after_its_limit(client, world, kind, limit):
    client.get(URLS[kind])
    world.age(KEYS[kind], limit - 5)
    assert client.get(URLS[kind]).headers["X-Cache"] == "HIT"
    world.age(KEYS[kind], limit + 5)
    assert client.get(URLS[kind]).headers["X-Cache"] == "MISS"
    assert len(world.fetches) == 2


def test_scraper_down_with_no_data_is_502(client, world):
    world.scraper_error = clients.UnavailableError("down")
    assert client.get(URLS["overview"]).status_code == 502
    assert world.told == ["AAPL"]  # so the scheduler can fill it in later


def test_scraper_down_with_old_data_serves_it_as_stale(client, world):
    client.get(URLS["overview"])
    world.age(KEYS["overview"], 5000)
    world.scraper_error = clients.UnavailableError("down")
    r = client.get(URLS["overview"])
    assert r.status_code == 200 and r.headers["X-Cache"] == "STALE"
    assert r.json()["price"] == 231.45


def test_unknown_ticker_is_404_and_not_stored_or_reported(client, world):
    world.scraper_error = clients.NotFoundError("ZZZZ")
    assert client.get("/companies/ZZZZ/overview").status_code == 404
    assert world.rows == {} and world.told == []


@pytest.mark.parametrize("repeat", [False, True])
def test_every_search_is_reported_to_the_scheduler(client, world, repeat):
    client.get(URLS["overview"])
    if repeat:
        world.told.clear()
        client.get(URLS["overview"])  # a HIT is still a search
    assert world.told == ["AAPL"]


def test_broken_database_does_not_break_the_api(monkeypatch):
    monkeypatch.setattr(
        config, "DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none"
    )
    monkeypatch.setattr(
        clients, "fetch", lambda kind, ticker, param: DATA[kind]
    )
    monkeypatch.setattr(clients, "tell_scheduler", lambda ticker: None)
    assert db.get("overview", "AAPL", None) is None
    db.put("overview", "AAPL", None, DATA["overview"])  # must not raise
    db.create_tables()  # must not raise
    r = TestClient(app).get(URLS["overview"])
    assert r.status_code == 200 and r.headers["X-Cache"] == "MISS"


def test_settings_come_from_the_environment(monkeypatch):
    import importlib

    monkeypatch.setenv("DATABASE_URL", "postgresql://u:secret@somewhere/db")
    monkeypatch.setenv("SCRAPER_URL", "http://scraper.test:1")
    monkeypatch.setenv("SCHEDULER_URL", "http://scheduler.test:2")
    try:
        importlib.reload(config)
        assert config.DATABASE_URL == "postgresql://u:secret@somewhere/db"
        assert config.SCRAPER_URL == "http://scraper.test:1"
        assert config.SCHEDULER_URL == "http://scheduler.test:2"
    finally:
        monkeypatch.undo()
        importlib.reload(config)


def test_openapi_lists_every_endpoint(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path in (
        "/health",
        "/companies/{ticker}/overview",
        "/companies/{ticker}/prices",
        "/companies/{ticker}/news",
    ):
        assert path in paths
