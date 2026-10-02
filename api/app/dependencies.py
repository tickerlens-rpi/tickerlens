"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends

from app.repositories import CompanyRepository, InMemoryCompanyRepository
from app.sample_data import SAMPLE_COMPANIES

_company_repository = InMemoryCompanyRepository(SAMPLE_COMPANIES)


def get_company_repository() -> CompanyRepository:
    """Returns the repository routes should use to look up companies."""
    return _company_repository


CompanyRepositoryDep = Annotated[
    CompanyRepository, Depends(get_company_repository)
]
