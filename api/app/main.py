"""Application entry point. Run with `uvicorn app.main:app --reload`."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import companies
from app.models import HealthStatus

# The Vite dev server. Override with a comma-separated list when deployed.
_DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def create_app() -> FastAPI:
    """Builds the FastAPI application."""
    app = FastAPI(
        title="TickerLens API",
        version="0.1.0",
        description=(
            "Central API for TickerLens. For research and education; it does"
            " not provide investment advice."
        ),
    )
    origins = os.environ.get("TICKERLENS_CORS_ORIGINS", _DEFAULT_CORS_ORIGINS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins.split(",")],
        allow_methods=["GET"],
    )
    app.include_router(companies.router)

    @app.get("/health", tags=["meta"])
    async def health() -> HealthStatus:
        """Reports that the API is running."""
        return HealthStatus()

    return app


app = create_app()
