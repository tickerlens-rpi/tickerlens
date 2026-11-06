"""TickerLens scraper API: company overview, price history and news from outside providers."""
import logging
import os
from datetime import datetime, timezone
from typing import Callable, Literal, TypeVar
from fastapi import Depends, FastAPI, HTTPException, Query
from app.abstract_classes import MarketDataProvider, NewsProvider
from app.combined import CombinedProvider
from app.errors import ProviderError, TickerNotFound
from app.finnhub import FinnhubProvider
from app.models import NewsResponse, Overview, PricesResponse
from app.yahoo import YahooPriceProvider


Result = TypeVar("Result")
logger = logging.getLogger("uvicorn.error")


#################
#### Helpers ####
#################


def normalize_ticker(raw: str) -> str:
    """' $aapl ' -> 'AAPL'; 'BRK.B' -> 'BRK-B' (mirrors the frontend)."""
    return raw.strip().lstrip("$").strip().upper().replace(".", "-")


def _build_provider() -> CombinedProvider | None:
    """Yahoo Finance (no key) supplies price history; Finnhub supplies overview figures and news."""
    finnhub_key = os.getenv("FINNHUB_API_KEY")
    if not finnhub_key:
        return None
    return CombinedProvider(
        fundamentals=FinnhubProvider(finnhub_key),
        prices=YahooPriceProvider(),
    )


def _configured_provider() -> CombinedProvider:
    if _provider is None:
        raise HTTPException(
            status_code=503,
            detail="Set FINNHUB_API_KEY to enable market data.",
        )
    return _provider


def get_market_provider() -> MarketDataProvider:
    return _configured_provider()


def get_news_provider() -> NewsProvider:
    return _configured_provider()


def _guard(fn: Callable[[], Result]) -> Result:
    """Call a data provider and map its errors to HTTP errors."""
    try:
        return fn()
    except TickerNotFound:
        raise HTTPException(404, "No data for that ticker.")
    except ProviderError as e:
        logger.warning("Provider error: %s", e)  # see it with: docker compose logs scrapper
        raise HTTPException(502, "A market data provider is unavailable.")


#################
#### Globals ####
#################


app = FastAPI(title="TickerLens API")
_provider = _build_provider()


#################
### Endpoints ###
#################


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/companies/{ticker}/overview", response_model=Overview)
def overview(ticker: str, provider: MarketDataProvider = Depends(get_market_provider)):
    t = normalize_ticker(ticker)
    data = _guard(lambda: provider.get_overview(t))
    return Overview(**data, last_updated=datetime.now(timezone.utc))


@app.get("/companies/{ticker}/prices", response_model=PricesResponse)
def prices(
    ticker: str,
    range: Literal["1W", "1M", "1Y", "5Y"] = "1M",
    provider: MarketDataProvider = Depends(get_market_provider),
):
    t = normalize_ticker(ticker)
    points = _guard(lambda: provider.get_prices(t, range))
    return PricesResponse(
        ticker=t,
        range=range,
        points=points,
        last_updated=datetime.now(timezone.utc),
    )


@app.get("/companies/{ticker}/news", response_model=NewsResponse)
def news(
    ticker: str,
    limit: int = Query(5, ge=1, le=20),
    provider: NewsProvider = Depends(get_news_provider),
):
    t = normalize_ticker(ticker)
    articles = _guard(lambda: provider.get_news(t, limit))
    return NewsResponse(
        ticker=t,
        articles=articles,
        last_updated=datetime.now(timezone.utc),
    )