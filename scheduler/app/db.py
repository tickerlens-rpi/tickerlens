"""The database (Postgres). Two tables: `cache` (the data, shared with the central API) and `watchlist`."""
import time
import psycopg
from psycopg.types.json import Jsonb
from app import config

SCHEMA = """
SELECT pg_advisory_xact_lock(7343);  -- the central API creates the same cache table; do not race it
CREATE TABLE IF NOT EXISTS cache (
    kind TEXT NOT NULL,
    ticker TEXT NOT NULL,
    param TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL,
    fetched_at DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (kind, ticker, param));
CREATE INDEX IF NOT EXISTS cache_ticker ON cache (ticker);
CREATE TABLE IF NOT EXISTS watchlist (
    ticker TEXT PRIMARY KEY,
    last_searched DOUBLE PRECISION NOT NULL);
"""


def _connect():
    return psycopg.connect(config.DATABASE_URL, connect_timeout=5)


def create_tables() -> None:
    with _connect() as conn:
        conn.execute(SCHEMA)


# ---------- the watchlist (the database is the list, so a restart loses nothing) ----------

def watch(ticker: str) -> None:
    """Add a ticker, or reset its one-week timer."""
    with _connect() as conn:
        conn.execute("INSERT INTO watchlist (ticker, last_searched) VALUES (%s,%s)"
                     " ON CONFLICT (ticker) DO UPDATE SET last_searched=EXCLUDED.last_searched",
                     (ticker, time.time()))


def watchlist() -> dict[str, float]:
    """{ticker: time of its last search}"""
    with _connect() as conn:
        return dict(conn.execute("SELECT ticker, last_searched FROM watchlist ORDER BY ticker").fetchall())


def forget(ticker: str) -> None:
    """Stop watching a ticker and delete its data."""
    with _connect() as conn:
        conn.execute("DELETE FROM watchlist WHERE ticker=%s", (ticker,))
        conn.execute("DELETE FROM cache WHERE ticker=%s", (ticker,))


def drop_expired(cutoff: float) -> list[str]:
    """Forget every ticker last searched before `cutoff`. Returns them."""
    with _connect() as conn:
        old = [row[0] for row in conn.execute("DELETE FROM watchlist WHERE last_searched < %s RETURNING ticker", (cutoff,))]
        conn.execute("DELETE FROM cache WHERE ticker = ANY(%s)", (old,))
    return old


# ---------- the data ----------

def put(kind: str, ticker: str, param: str | None, payload: dict) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO cache (kind, ticker, param, payload, fetched_at) VALUES (%s,%s,%s,%s,%s)"
            " ON CONFLICT (kind, ticker, param) DO UPDATE"
            " SET payload=EXCLUDED.payload, fetched_at=EXCLUDED.fetched_at",
            (kind, ticker, param or "", Jsonb(payload), time.time()))


def stored_times(tickers: list[str]) -> dict[str, dict[tuple[str, str | None], float]]:
    """{ticker: {(kind, param): fetched_at}} for everything stored for these tickers."""
    result = {ticker: {} for ticker in tickers}
    with _connect() as conn:
        rows = conn.execute("SELECT ticker, kind, param, fetched_at FROM cache WHERE ticker = ANY(%s)", (tickers,))
        for ticker, kind, param, fetched_at in rows:
            result[ticker][(kind, param or None)] = fetched_at
    return result