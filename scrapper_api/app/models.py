"""Response models. FastAPI turns these into the OpenAPI contract."""
from datetime import datetime
from pydantic import BaseModel


class Overview(BaseModel):
    ticker: str
    name: str
    exchange: str | None = None
    price: float
    change_1d_pct: float | None = None
    change_1w_pct: float | None = None
    market_cap: int | None = None
    pe_ratio: float | None = None
    eps: float | None = None
    revenue_growth_pct: float | None = None
    last_updated: datetime


class PricePoint(BaseModel):
    date: str
    close: float


class PricesResponse(BaseModel):
    ticker: str
    range: str
    points: list[PricePoint]
    last_updated: datetime


class Article(BaseModel):
    headline: str
    publisher: str | None = None
    published_at: datetime | None = None
    url: str
    summary: str | None = None


class NewsResponse(BaseModel):
    ticker: str
    articles: list[Article]
    last_updated: datetime