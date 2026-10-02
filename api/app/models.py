"""Response models for the central API.

These models generate the OpenAPI schema, which is the contract between the
frontend and the backend. Changing a field here changes that contract.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Exchange = Literal["NYSE", "NASDAQ"]


class HealthStatus(BaseModel):
    """Liveness response for monitoring and smoke tests."""

    status: Literal["ok"] = "ok"


class Company(BaseModel):
    """A listed company, as shown in search suggestions and page headers."""

    model_config = ConfigDict(frozen=True)

    ticker: str = Field(examples=["AAPL"])
    name: str = Field(examples=["Apple Inc."])
    exchange: Exchange


class CompanySearchResults(BaseModel):
    """Companies matching a search, best match first."""

    query: str = Field(description="The search text as received.")
    results: list[Company]
