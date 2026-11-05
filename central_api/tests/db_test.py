"""Tests for the database. They need a real Postgres.

Set TEST_DATABASE_URL to run them. They drop and recreate the `cache` table,
so point it at a throwaway database.
"""
import os
import time
import psycopg
import pytest
from fastapi.testclient import TestClient
from app import clients, config, db
from app.main import app

DB_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DB_URL, reason="set TEST_DATABASE_URL to run the Postgres tests"
)

OVERVIEW = {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "price": 231.45,
    "last_updated": "2026-11-04T12:00:00Z",
}


@pytest.fixture
def pg(monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", DB_URL)
    with psycopg.connect(DB_URL) as conn:
        conn.execute("DROP TABLE IF EXISTS cache")
    db.create_tables()


def test_store_and_read(pg):
    assert db.get("overview", "AAPL", None) is None
    before = time.time()
    db.put("overview", "AAPL", None, OVERVIEW)
    payload, fetched_at = db.get("overview", "AAPL", None)
    assert payload == OVERVIEW and before <= fetched_at <= time.time()


def test_put_replaces_and_parameters_stay_apart(pg):
    db.put("prices", "AAPL", "1W", {"a": 1})
    db.put("prices", "AAPL", "1Y", {"b": 2})
    db.put("prices", "AAPL", "1W", {"c": 3})
    assert db.get("prices", "AAPL", "1W")[0] == {"c": 3}
    assert db.get("prices", "AAPL", "1Y")[0] == {"b": 2}


def test_whole_flow_through_a_real_database(pg, monkeypatch):
    fetched = []

    def fetch(kind, ticker, param):
        fetched.append(kind)
        return OVERVIEW

    monkeypatch.setattr(clients, "fetch", fetch)
    monkeypatch.setattr(clients, "tell_scheduler", lambda ticker: None)
    client = TestClient(app)
    url = "/companies/AAPL/overview"
    assert client.get(url).headers["X-Cache"] == "MISS"
    assert client.get(url).headers["X-Cache"] == "HIT"
    assert len(fetched) == 1
