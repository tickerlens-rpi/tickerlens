"""Scheduler tests. Offline, except the Postgres ones: set TEST_DATABASE_URL to run those
(they drop and recreate the `cache` and `watchlist` tables). Run from scheduler:  python -m pytest -v
"""
import asyncio
import os

import httpx
import pytest
from fastapi.testclient import TestClient

from app import config, db, main, refresh

WEEK = 7 * 24 * 3600
DEFAULT_SETS = 6  # overview, 4 price ranges, news


class World:
    """Fake clock, database and scraper, so a test only describes the situation."""

    def __init__(self):
        self.now = 1_000_000.0
        self.watch, self.cache = {}, {}     # ticker -> last searched; (kind, ticker, param) -> (payload, fetched_at)
        self.fetches = []                   # what was asked of the scraper
        self.errors = {}                    # ticker -> exception to raise instead of data
        self.kind_errors = {}               # kind -> exception to raise instead of data

    # the clock (stands in for the `time` module)
    def time(self):
        return self.now

    def sleep(self, seconds):
        pass

    # the scraper
    def fetch(self, kind, ticker, param):
        self.fetches.append((kind, ticker, param))
        if kind in self.kind_errors:
            raise self.kind_errors[kind]
        if ticker in self.errors:
            raise self.errors[ticker]
        return {"kind": kind, "ticker": ticker, "param": param}

    # the database
    def db_watch(self, ticker):
        self.watch[ticker] = self.now

    def db_watchlist(self):
        return dict(sorted(self.watch.items()))

    def db_put(self, kind, ticker, param, payload):
        self.cache[(kind, ticker, param)] = (payload, self.now)

    def db_stored_times(self, tickers):
        return {t: {(k, p): at for (k, tk, p), (_, at) in self.cache.items() if tk == t} for t in tickers}

    def db_forget(self, ticker):
        self.watch.pop(ticker, None)
        self.cache = {key: row for key, row in self.cache.items() if key[1] != ticker}

    def db_drop_expired(self, cutoff):
        old = [t for t, at in self.watch.items() if at < cutoff]
        for t in old:
            self.db_forget(t)
        return old


@pytest.fixture
def world(monkeypatch):
    w = World()
    for module in (refresh, main):
        monkeypatch.setattr(module, "time", w)
    for name in ("watch", "watchlist", "put", "stored_times", "forget", "drop_expired"):
        monkeypatch.setattr(db, name, getattr(w, "db_" + name))
    monkeypatch.setattr(refresh, "fetch", w.fetch)
    monkeypatch.setattr(config, "FAILURE_BACKOFF_SECONDS", 300)
    refresh._failed_at.clear()
    return w


@pytest.fixture
def client(world):
    return TestClient(main.app)  # no lifespan: no real database, no loop


# ======================= the endpoint the central API calls =======================

def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_watch_adds_a_ticker_and_says_when_it_will_be_dropped(client, world):
    r = client.post("/watch/AAPL")
    assert r.status_code == 200 and r.json()["ticker"] == "AAPL" and list(world.watch) == ["AAPL"]
    assert r.json()["watched_until"].startswith("1970-01-")  # fake clock; one week after 1,000,000 s


@pytest.mark.parametrize(("raw", "clean"), [("aapl", "AAPL"), ("$nke", "NKE"), ("brk.b", "BRK-B")])
def test_tickers_are_normalized(client, world, raw, clean):
    client.post(f"/watch/{raw}")
    assert list(world.watch) == [clean]


def test_searching_the_same_ticker_again_resets_its_timer(client, world):
    client.post("/watch/AAPL")
    world.now += 5000
    client.post("/watch/AAPL")
    assert world.watch == {"AAPL": world.now}


@pytest.mark.parametrize("bad", ["TOOLONGTICKERNAME", "A%20B", "AAPL%3Bdrop", "..%2Fx"])
def test_invalid_tickers_are_rejected(client, world, bad):
    assert client.post(f"/watch/{bad}").status_code in (404, 422) and world.watch == {}  # 404: a slash never reaches the route


def test_a_database_error_gives_503(client, monkeypatch):
    import psycopg

    def broken(ticker):
        raise psycopg.OperationalError("down")

    monkeypatch.setattr(db, "watch", broken)
    assert client.post("/watch/AAPL").status_code == 503


def test_watchlist_lists_everything(client):
    client.post("/watch/NKE"); client.post("/watch/AAPL")
    assert [row["ticker"] for row in client.get("/watchlist").json()] == ["AAPL", "NKE"]


# ======================= refreshing =======================

def test_empty_watchlist_does_nothing(world):
    assert refresh.run_once() == {"expired": 0, "refreshed": 0, "failed": 0} and world.fetches == []


def test_a_new_ticker_gets_every_default_data_set(world):
    world.db_watch("AAPL")
    assert refresh.run_once()["refreshed"] == DEFAULT_SETS
    assert set(world.cache) == {(kind, "AAPL", param) for kind, param in config.DEFAULT_JOBS}


def test_nothing_is_fetched_while_data_is_fresh(world):
    world.db_watch("AAPL")
    refresh.run_once()
    world.fetches.clear()
    world.now += 600
    refresh.run_once()
    assert world.fetches == []


def test_overview_and_prices_refresh_every_15_minutes_and_news_every_hour(world):
    world.db_watch("AAPL")
    refresh.run_once()
    world.fetches.clear()
    world.now += 850  # inside the last minute before the 900 s limit
    refresh.run_once()
    assert {kind for kind, _, _ in world.fetches} == {"overview", "prices"}
    world.fetches.clear()
    world.now += 2750  # 3600 s since the first pass: news is due
    refresh.run_once()
    assert ("news", "AAPL", "5") in world.fetches


def test_data_the_central_api_stored_on_demand_is_refreshed_too(world):
    world.db_watch("AAPL")
    world.cache[("news", "AAPL", "12")] = ({}, world.now - 4000)  # someone asked for 12 articles
    refresh.run_once()
    assert ("news", "AAPL", "12") in world.fetches


def test_a_failed_refresh_keeps_the_old_data_and_waits_before_retrying(world):
    world.db_watch("AAPL")
    refresh.run_once()
    old = dict(world.cache)
    world.now += 900
    world.errors["AAPL"] = refresh.Unavailable("down")
    assert refresh.run_once()["failed"] == DEFAULT_SETS - 1  # news is not due yet
    assert world.cache == old
    world.fetches.clear()
    world.now += 100  # inside the 5 minute back-off
    refresh.run_once()
    assert world.fetches == []
    world.now += 250
    del world.errors["AAPL"]
    assert refresh.run_once()["refreshed"] == DEFAULT_SETS - 1


def test_one_failing_ticker_does_not_stop_the_others(world):
    world.db_watch("BAD"); world.db_watch("AAPL")
    world.errors["BAD"] = refresh.Unavailable("down")
    counts = refresh.run_once()
    assert counts["failed"] == DEFAULT_SETS and counts["refreshed"] == DEFAULT_SETS
    assert ("overview", "AAPL", None) in world.cache


def test_an_unknown_ticker_is_dropped_with_its_data(world):
    world.db_watch("ZZZZ")
    world.errors["ZZZZ"] = refresh.NotFound("ZZZZ")
    refresh.run_once()
    assert world.fetches == [("overview", "ZZZZ", None)]  # asked first, rest skipped
    assert world.watch == {} and world.cache == {}


def test_a_ticker_missing_only_one_kind_of_data_is_kept(world):
    world.db_watch("IPO")
    world.kind_errors["prices"] = refresh.NotFound("IPO")  # e.g. Yahoo has no history
    counts = refresh.run_once()
    assert counts == {"expired": 0, "refreshed": 2, "failed": 4}
    assert list(world.watch) == ["IPO"]
    assert {key[0] for key in world.cache} == {"overview", "news"}  # data kept
    world.fetches.clear()
    world.now += 100  # inside the back-off: do not hammer the scraper
    refresh.run_once()
    assert world.fetches == []


def test_the_overview_is_always_asked_first(world):
    world.db_watch("AAPL")
    refresh.run_once()
    assert world.fetches[0] == ("overview", "AAPL", None)


# ======================= the one-week hold =======================

def test_a_ticker_is_kept_for_a_week_after_its_last_search(world):
    world.db_watch("AAPL")
    refresh.run_once()
    world.now += WEEK - 10
    assert refresh.run_once()["expired"] == 0 and list(world.watch) == ["AAPL"]
    world.db_watch("AAPL")  # searched again: the week starts over
    world.now += WEEK - 10
    assert refresh.run_once()["expired"] == 0 and list(world.watch) == ["AAPL"]


def test_a_ticker_not_searched_for_a_week_is_dropped_with_its_data(world):
    world.db_watch("AAPL")
    refresh.run_once()
    world.now += WEEK + 1
    world.fetches.clear()
    assert refresh.run_once()["expired"] == 1
    assert world.watch == {} and world.cache == {} and world.fetches == []


# ======================= the loop that never stops =======================

def test_the_loop_runs_again_and_again_even_after_a_crash(monkeypatch):
    runs = []

    def crash():
        runs.append(1)
        raise RuntimeError("boom")

    monkeypatch.setattr(refresh, "run_once", crash)
    monkeypatch.setattr(config, "TICK_SECONDS", 0.01)

    async def run():
        task = asyncio.create_task(main.refresh_forever())
        await asyncio.sleep(0.1)
        assert not task.done()
        task.cancel()

    asyncio.run(run())
    assert len(runs) >= 2


# ======================= talking to the scraper =======================

def test_fetch_builds_the_right_requests(monkeypatch):
    seen = []
    monkeypatch.setattr(httpx, "get", lambda url, params=None, timeout=None: seen.append((url, params)) or httpx.Response(200, json={}))
    refresh.fetch("overview", "AAPL", None); refresh.fetch("prices", "AAPL", "1Y"); refresh.fetch("news", "AAPL", "7")
    base = config.SCRAPER_URL
    assert seen == [(f"{base}/companies/AAPL/overview", {}), (f"{base}/companies/AAPL/prices", {"range": "1Y"}),
                    (f"{base}/companies/AAPL/news", {"limit": "7"})]


@pytest.mark.parametrize(("response", "error"), [
    (httpx.Response(404), refresh.NotFound), (httpx.Response(502), refresh.Unavailable),
    (httpx.Response(200, text="<html>"), refresh.Unavailable), (httpx.ConnectError("refused"), refresh.Unavailable),
    (httpx.ReadTimeout("slow"), refresh.Unavailable),
])
def test_fetch_maps_failures(monkeypatch, response, error):
    def fake_get(*a, **k):
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(error):
        refresh.fetch("overview", "AAPL", None)


# ======================= real Postgres =======================

DB_URL = os.getenv("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not DB_URL, reason="set TEST_DATABASE_URL to run the Postgres tests")


@pytest.fixture
def pg(monkeypatch):
    import psycopg
    monkeypatch.setattr(config, "DATABASE_URL", DB_URL)
    with psycopg.connect(DB_URL) as conn:
        conn.execute("DROP TABLE IF EXISTS cache, watchlist")
    db.create_tables()


@needs_db
def test_postgres_data_roundtrip(pg):
    db.put("overview", "AAPL", None, {"a": 1})
    db.put("prices", "AAPL", "1W", {"b": 2})
    db.put("prices", "AAPL", "1W", {"b": 3})  # replaces
    db.put("news", "NKE", "5", {"c": 1})
    times = db.stored_times(["AAPL", "NKE", "NONE"])
    assert set(times["AAPL"]) == {("overview", None), ("prices", "1W")} and set(times["NKE"]) == {("news", "5")}
    assert times["NONE"] == {} and db.stored_times([]) == {}


@needs_db
def test_postgres_watchlist(pg):
    db.watch("AAPL"); db.watch("NKE")
    first = db.watchlist()["AAPL"]
    db.watch("AAPL")  # resets, no duplicate
    assert list(db.watchlist()) == ["AAPL", "NKE"] and db.watchlist()["AAPL"] >= first


@needs_db
def test_postgres_forget_only_forgets_that_ticker(pg):
    db.watch("AAPL"); db.watch("NKE")
    db.put("overview", "AAPL", None, {}); db.put("overview", "NKE", None, {})
    db.forget("AAPL")
    assert list(db.watchlist()) == ["NKE"] and db.stored_times(["AAPL", "NKE"])["AAPL"] == {}
    assert ("overview", None) in db.stored_times(["NKE"])["NKE"]


@needs_db
def test_postgres_drop_expired(pg):
    import time
    db.watch("OLD"); db.put("overview", "OLD", None, {})
    time.sleep(0.05)
    db.watch("NEW"); db.put("overview", "NEW", None, {})
    assert db.drop_expired(db.watchlist()["NEW"]) == ["OLD"]
    assert list(db.watchlist()) == ["NEW"] and db.stored_times(["OLD"])["OLD"] == {}
    assert db.drop_expired(0) == []  # nothing old: must not fail on the empty list


@needs_db
def test_postgres_full_pass_and_a_restart_keeps_the_list(pg, monkeypatch):
    monkeypatch.setattr(refresh, "fetch", lambda kind, ticker, param: {"kind": kind})
    monkeypatch.setattr(refresh.time, "sleep", lambda s: None)
    refresh._failed_at.clear()
    db.watch("AAPL")
    assert refresh.run_once()["refreshed"] == DEFAULT_SETS
    assert len(db.stored_times(["AAPL"])["AAPL"]) == DEFAULT_SETS
    assert list(db.watchlist()) == ["AAPL"]  # read straight from the database, as after a restart