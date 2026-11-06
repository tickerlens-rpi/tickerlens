"""The database (Postgres): one `cache` table. The scheduler writes to it too.

A database error never breaks a request: a failed read counts as "no data",
and a failed write is skipped.
"""
import logging
import time
import psycopg
from psycopg.types.json import Jsonb
from app import config

log = logging.getLogger("uvicorn.error")

SCHEMA = """
SELECT pg_advisory_xact_lock(7343);  -- the scheduler makes the same table too
CREATE TABLE IF NOT EXISTS cache (
    kind TEXT NOT NULL,
    ticker TEXT NOT NULL,
    param TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL,
    fetched_at DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (kind, ticker, param));
CREATE INDEX IF NOT EXISTS cache_ticker ON cache (ticker);
"""


def _connect():
    return psycopg.connect(config.DATABASE_URL, connect_timeout=5)


def create_tables() -> None:
    """Creates the tables if they are missing."""
    try:
        with _connect() as conn:
            conn.execute(SCHEMA)
    except psycopg.Error:
        log.exception("Could not create the tables (is the database up?)")


def get(kind: str, ticker: str, param: str | None) -> tuple[dict, float] | None:
    """Reads one stored item.

    Args:
        kind: overview, prices or news.
        ticker: A normalized ticker, such as AAPL.
        param: The price range or news limit, or None for an overview.

    Returns:
        (payload, fetched_at), or None if nothing is stored.
    """
    sql = (
        "SELECT payload, fetched_at FROM cache"
        " WHERE kind=%s AND ticker=%s AND param=%s"
    )
    try:
        with _connect() as conn:
            row = conn.execute(sql, (kind, ticker, param or "")).fetchone()
    except psycopg.Error:
        log.exception("Database read failed")
        return None
    return (row[0], row[1]) if row else None


def put(kind: str, ticker: str, param: str | None, payload: dict) -> None:
    """Stores one item, replacing any earlier copy."""
    sql = (
        "INSERT INTO cache (kind, ticker, param, payload, fetched_at)"
        " VALUES (%s,%s,%s,%s,%s)"
        " ON CONFLICT (kind, ticker, param) DO UPDATE"
        " SET payload=EXCLUDED.payload, fetched_at=EXCLUDED.fetched_at"
    )
    try:
        with _connect() as conn:
            conn.execute(
                sql, (kind, ticker, param or "", Jsonb(payload), time.time())
            )
    except psycopg.Error:
        log.exception("Database write failed")
