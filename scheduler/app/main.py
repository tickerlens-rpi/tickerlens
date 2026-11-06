"""TickerLens scheduler.

Keeps a list of tickers people searched for. A loop that never stops refreshes each one's data in the
database (through the scraper). A ticker is dropped one week after its last search; searching it
again resets that timer. The central API reports searches with POST /watch/{ticker}.
"""
import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import psycopg
from fastapi import FastAPI, HTTPException
from app import config, db, refresh

log = logging.getLogger("uvicorn.error")


async def refresh_forever():
    while True:
        try:
            counts = await asyncio.to_thread(refresh.run_once)
            if any(counts.values()):
                log.info("Refresh pass: %s", counts)
        except Exception:  # the loop must never stop
            log.exception("Refresh pass crashed")
        await asyncio.sleep(config.TICK_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.create_tables()
    task = asyncio.create_task(refresh_forever())
    yield
    task.cancel()


app = FastAPI(title="TickerLens Scheduler", lifespan=lifespan)


def _until(last_searched: float) -> str:
    return datetime.fromtimestamp(last_searched + config.WATCH_SECONDS, tz=timezone.utc).isoformat()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/watch/{ticker}")
def watch(ticker: str):
    """'This ticker was just searched.' Adds it to the list, or resets its one-week timer."""
    ticker = ticker.strip().lstrip("$").strip().upper().replace(".", "-")
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9\-]{0,9}", ticker):
        raise HTTPException(422, "Not a valid ticker.")
    try:
        db.watch(ticker)
    except psycopg.Error:
        log.exception("Could not save %s", ticker)
        raise HTTPException(503, "Database unavailable.")
    return {"ticker": ticker, "watched_until": _until(time.time())}


@app.get("/watchlist")
def show_watchlist():
    """Everything being kept fresh. Internal use."""
    return [{"ticker": t, "watched_until": _until(at)} for t, at in db.watchlist().items()]