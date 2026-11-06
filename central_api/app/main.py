"""TickerLens central API: the one service the frontend talks to.

Company search and lookup come from the bundled list of NYSE and NASDAQ
companies (see companies.py). For market data it looks in the database
first. If there is no data, or it is out of date, it asks the scraper and
stores the result. Every data request is also reported to the scheduler,
which keeps that ticker fresh for a week.
"""
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from app import clients, config, db
from app.companies import CompanyDirectory, get_directory
from app.models import (
    Company,
    CompanySearchResults,
    NewsResponse,
    Overview,
    PricesResponse,
)

TICKER_PATTERN = re.compile(r"[A-Z0-9][A-Z0-9\-]{0,9}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Creates the database tables when the app starts."""
    db.create_tables()
    yield


app = FastAPI(title="TickerLens Central API", lifespan=lifespan)

# Browsers reach the API through the frontend's own origin (nginx or the Vite
# dev server forward /api), so CORS is off unless a deployment asks for it.
if _origins := os.getenv("TICKERLENS_CORS_ORIGINS"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in _origins.split(",")],
        allow_methods=["GET"],
    )


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


@app.get("/companies/search", response_model=CompanySearchResults)
def search_companies(
    q: str = Query(min_length=1, max_length=64),
    limit: int = Query(8, ge=1, le=20),
    directory: CompanyDirectory = Depends(get_directory),
):
    """Suggests NYSE and NASDAQ companies matching a name or ticker.

    No matches is an empty list, not an error, so the frontend can say so.
    """
    return CompanySearchResults(query=q, results=directory.search(q, limit))


@app.get(
    "/companies/{ticker}",
    response_model=Company,
    responses={404: {"description": "Not a NYSE or NASDAQ company."}},
)
def get_company(
    ticker: str, directory: CompanyDirectory = Depends(get_directory)
):
    """Returns the company with this ticker, for the company page header."""
    company = directory.get(_clean_ticker(ticker))
    if company is None:
        raise HTTPException(404, "No company found for that ticker.")
    return company


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
