"""TickerLens central API: the one service the frontend talks to.

Looks in the database first. If there is no data, or it is out of date, it
asks the scraper and stores the result. Every search is also reported to the
scheduler, which keeps that ticker fresh for a week.
"""
import re
import time
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, HTTPException, Query, Response
from app import clients, config, db
from app.models import NewsResponse, Overview, PricesResponse

TICKER_PATTERN = re.compile(r"[A-Z0-9][A-Z0-9\-]{0,9}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Creates the database tables when the app starts."""
    db.create_tables()
    yield


app = FastAPI(title="TickerLens Central API", lifespan=lifespan)


def _clean_ticker(raw: str) -> str:
    """Turns " $brk.b " into "BRK-B", or raises a 422 if it is not a ticker."""
    ticker = raw.strip().lstrip("$").strip().upper().replace(".", "-")
    if not TICKER_PATTERN.fullmatch(ticker):
        raise HTTPException(422, "Not a valid ticker.")
    return ticker


def _serve(
    response: Response, kind: str, raw_ticker: str, param: str | None = None
) -> dict:
    ticker = _clean_ticker(raw_ticker)
    cached = db.get(kind, ticker, param)  # (payload, fetched_at) or None

    if cached and time.time() - cached[1] < config.TTL[kind]:
        payload, status = cached[0], "HIT"
    else:
        try:
            payload, status = clients.fetch(kind, ticker, param), "MISS"
        except clients.NotFoundError:
            raise HTTPException(404, "No data for that ticker.") from None
        except clients.UnavailableError:
            if cached is None:
                clients.tell_scheduler(ticker)  # so it can fill this in later
                raise HTTPException(
                    502, "Market data is temporarily unavailable."
                ) from None
            payload, status = cached[0], "STALE"  # old data beats no data
        else:
            db.put(kind, ticker, param, payload)

    clients.tell_scheduler(ticker)
    response.headers["X-Cache"] = status  # HIT, MISS or STALE
    return payload


@app.get("/health")
def health():
    """Says the API is up."""
    return {"status": "ok"}


@app.get("/companies/{ticker}/overview", response_model=Overview)
def overview(ticker: str, response: Response):
    """Returns the company's price, market cap, P/E, EPS and growth."""
    return _serve(response, "overview", ticker)


@app.get("/companies/{ticker}/prices", response_model=PricesResponse)
def prices(
    ticker: str,
    response: Response,
    range: Literal["1W", "1M", "1Y", "5Y"] = "1M",
):
    """Returns closing prices for the chosen range."""
    return _serve(response, "prices", ticker, range)


@app.get("/companies/{ticker}/news", response_model=NewsResponse)
def news(ticker: str, response: Response, limit: int = Query(5, ge=1, le=20)):
    """Returns recent news articles, newest first."""
    return _serve(response, "news", ticker, str(limit))
