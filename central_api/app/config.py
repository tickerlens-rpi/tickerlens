"""Settings for the central API."""

import os

SCRAPER_URL = os.getenv("SCRAPER_URL", "http://scrapper:8001")
SCHEDULER_URL = os.getenv("SCHEDULER_URL", "http://scheduler:8002")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://tickerlens:tickerlens@database:5432/tickerlens",
)

# Data older than this (seconds) is out of date and gets fetched fresh.
TTL = {"overview": 900, "prices": 900, "news": 3600}  # 15 min, 15 min, 1 hour

# Tell the scheduler about a ticker at most this often (seconds).
NOTIFY_EVERY_SECONDS = 60
