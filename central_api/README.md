# central API (port 8000)

The frontend's only contact. Company search and lookup, plus the
scrapper's market data endpoints with a database cache in front:

| Method and path | Out of date after |
|---|---|
| `GET /companies/search?q=...&limit=1..20` | never (bundled list) |
| `GET /companies/{ticker}` | never (bundled list) |
| `GET /companies/{ticker}/overview` | 15 min |
| `GET /companies/{ticker}/prices?range=1W\|1M\|1Y\|5Y` | 15 min |
| `GET /companies/{ticker}/news?limit=1..20` | 1 hour |
| `GET /health` | |

Responses carry `X-Cache: HIT | MISS | STALE`. Errors: 404 unknown ticker, 422 bad ticker or parameter, 502 no data available.

## Company search

`app/companies.py` searches `app/data/companies.csv`, about 5,600 operating
companies listed on NYSE and NASDAQ (no ETFs, warrants or preferred shares).
The routes depend on the abstract `CompanyDirectory`, so a database-backed
directory can replace the CSV later without touching them. Refresh the list
from Nasdaq Trader's symbol directory with:

```
python scripts/build_company_list.py
```

## How market data works

1. Check the ticker: after trimming, removing `$` and upper-casing it must be 1 to 10 letters, digits or `-` (`brk.b` becomes `BRK-B`). Anything else is a 422 and nothing else happens.
2. Look in the database. Fresh data → return it (`HIT`).
3. Missing or out of date → ask the scrapper, store the result, return it (`MISS`).
4. Scrapper down → return the old data if there is some (`STALE`), otherwise 502. Unknown ticker → 404.
5. Every search except a 404 tells the scheduler (`POST /watch/{ticker}`) in the background, at most once a minute per ticker. A failure there never affects the request.
6. A database error never breaks a request: it is treated as "no data".

## Files

| File | |
|---|---|
| `app/main.py` | The endpoints and the logic above |
| `app/companies.py` | Company search and lookup over `app/data/companies.csv` |
| `scripts/build_company_list.py` | Rebuilds `app/data/companies.csv` |
| `app/db.py` | Postgres: read and write the `cache` table |
| `app/clients.py` | Calls to the scrapper and the scheduler |
| `app/config.py` | `SCRAPER_URL`, `SCHEDULER_URL` and `DATABASE_URL` (read from the environment, with defaults for compose), and how long data stays fresh |
| `app/models.py` | Response shapes (copy of the scrapper's) |
| `tests/*_test.py` | Tests |

## Tests and lint

```
pip install -r requirements.txt pytest ruff
python -m pytest -q
ruff check --select F,E9 .
```

Tests are offline, except `tests/db_test.py`, which needs a real Postgres and
runs when `TEST_DATABASE_URL` is set (it drops the `cache` table, so point it
at a throwaway database), and `tests/deployment_test.py`, which needs a
running stack. CI runs the same commands.
