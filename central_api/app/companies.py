"""Routes for finding companies."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import CompanyRepositoryDep
from app.models import Company, CompanySearchResults

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/search")
async def search_companies(
    repository: CompanyRepositoryDep,
    q: Annotated[
        str,
        Query(
            min_length=1,
            max_length=64,
            description="A company name or ticker, such as Apple or AAPL.",
        ),
    ],
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
) -> CompanySearchResults:
    """Suggests companies matching a name or ticker.

    A search with no matches returns an empty list, not an error, so the
    frontend can show its "no results" message.
    """
    results = await repository.search(q, limit)
    return CompanySearchResults(query=q, results=results)


@router.get(
    "/{ticker}",
    responses={status.HTTP_404_NOT_FOUND: {"description": "Unknown ticker."}},
)
async def get_company(ticker: str, repository: CompanyRepositoryDep) -> Company:
    """Returns the company with this ticker."""
    company = await repository.get(ticker)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No company found for ticker {ticker!r}.",
        )
    return company
