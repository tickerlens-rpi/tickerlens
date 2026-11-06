"""Settings."""
import os

SCRAPER_URL = os.getenv("SCRAPER_URL", "http://scrapper:8001")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://tickerlens:tickerlens@database:5432/tickerlens")

WATCH_SECONDS = 7 * 24 * 3600  # a ticker is dropped 1 week after its last search

# How often each kind of data is refreshed (seconds). Keep equal to the central API's TTL.
INTERVAL = {"overview": 900, "prices": 900, "news": 3600}  # 15 min, 15 min, 1 hour

# What every watched ticker gets. Anything else the central API stored for it (say news with limit=10) is refreshed too.
DEFAULT_JOBS = [("overview", None), ("prices", "1W"), ("prices", "1M"), ("prices", "1Y"), ("prices", "5Y"), ("news", "5")]

TICK_SECONDS = 60               # how often the loop wakes up; data is refreshed this long before it goes out of date
PAUSE_SECONDS = 1               # gap between scraper calls (Finnhub allows 60 a minute)
FAILURE_BACKOFF_SECONDS = 300   # wait this long before retrying something that failed