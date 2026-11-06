# scheduler (port 8002, internal only)

Keeps the list of tickers people searched for, and keeps their data fresh in the database.

| Endpoint | |
|---|---|
| `POST /watch/{ticker}` | "This ticker was just searched." Adds it, or resets its one-week timer. Called by the central API. |
| `GET /watchlist` | What is being watched and until when |
| `GET /health` | |

## The loop

It never stops. Every minute it:

1. Drops tickers not searched for 1 week, together with their stored data.
2. For every other ticker, asks the scrapper for anything about to go out of date and stores it in the database.
   - overview and prices (1W, 1M, 1Y, 5Y): every 15 minutes
   - news (5 articles): every hour
   - anything else the central API stored for the ticker (say news with 10 articles) is refreshed too

A ticker whose overview the scrapper cannot find is dropped at once, with its data. If only prices or news are missing (say Yahoo has no prices for a stock) the ticker and its other data are kept. A failed refresh keeps the old data and is retried after 5 minutes. The watchlist is a table in the database, so a restart loses nothing.

## Files

| File | |
|---|---|
| `app/main.py` | The endpoints and the loop |
| `app/refresh.py` | One pass of the work, and the call to the scrapper |
| `app/db.py` | Postgres: the `watchlist` and `cache` tables |
| `app/config.py` | URLs (from environment), intervals and timings. Keep the intervals equal to the central API's `TTL`. |

## Tests

```
pip install -r requirements-dev.txt
python -m pytest -v
```

Offline, except the Postgres tests that run when `TEST_DATABASE_URL` is set. Those drop the `cache` and `watchlist` tables, so point it at a throwaway database.