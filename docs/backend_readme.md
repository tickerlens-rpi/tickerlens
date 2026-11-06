# TickerLens backend: how the containers fit together

```
frontend ──> central ──> database (Postgres)
               │  ▲            ▲
               │  └─ scrapper ─┤  (central fetches when data is missing or old)
               │               │
               └─ "AAPL was searched" ─> scheduler ──> scrapper ──> database
```

| Container | Port | Job |
|---|---|---|
| `scrapper` | 8001 | Fetches fresh data: overview and news from Finnhub, prices from Yahoo Finance. Stores nothing. |
| `database` | none | Postgres. Holds the cached data and the scheduler's watchlist. Only central and scheduler connect to it. |
| `central` | 8000 | The only thing the frontend talks to. Looks in the database. If the data is missing or out of date it asks the scrapper, saves the result, and tells the scheduler the ticker was searched. |
| `scheduler` | 8002 (internal) | Keeps the watchlist of searched tickers and refreshes their data in the database before it goes out of date. Drops a ticker one week after its last search. |

## What the frontend can call (central, port 8000)

The browser never calls port 8000 directly: the frontend container's nginx
forwards `/api/...` to central, so the site and its API share one origin.
Company search and lookup come from a bundled list of NYSE and NASDAQ
companies and never touch the scrapper:

| Endpoint | Out of date after |
|---|---|
| `GET /companies/search?q=...&limit=1..20` | never (bundled list) |
| `GET /companies/{ticker}` | never (bundled list) |

Market data:

| Endpoint | Out of date after |
|---|---|
| `GET /companies/{ticker}/overview` | 15 min |
| `GET /companies/{ticker}/prices?range=1W\|1M\|1Y\|5Y` (default `1M`) | 15 min |
| `GET /companies/{ticker}/news?limit=1..20` (default `5`) | 1 hour |
| `GET /health` | |

Every data response has an `X-Cache` header: `HIT` (fresh data from the database), `MISS` (just fetched) or `STALE` (scrapper down, old data served). The body's `last_updated` is when the scrapper fetched the data. Errors: 404 unknown ticker, 422 bad parameter, 502 no data available.

## Rules in one place

- **Out of date:** overview 15 min, prices 15 min, news 1 hour. The values are constants in each service's `config.py`. Central's `TTL` and the scheduler's `INTERVAL` must stay equal.
- **Every search tells the scheduler.** Central reports it in the background, at most once a minute per ticker. The scheduler adds the ticker, or resets its one-week timer. Unknown tickers (404) are never reported.
- **Scheduler loop:** every minute it drops tickers not searched for a week (with their data), then refreshes anything about to go out of date: overview and prices every 15 minutes, news (5 articles) every hour. Any other data central stored for the ticker, such as news with 10 articles, is refreshed too.
- **Scrapper down:** central serves the old data it has (`STALE`), otherwise 502. The scheduler keeps the old data after a failed refresh and tries again after 5 minutes.
- **Database down:** central still works by calling the scrapper directly. The scheduler pass fails and retries a minute later.
- **Scheduler restart:** nothing is lost. The watchlist is a table in the database.

## Folders

```
tickerlens/
  docker-compose.yml
  .env.example         FINNHUB_API_KEY and POSTGRES_PASSWORD; copy to .env
  scrapper_api/        fetches data
  central_api/         the frontend talks to this
  scheduler/           keeps searched tickers fresh
  database/            Postgres
```

Each folder has its own Dockerfile and README.

## Run

Copy `.env.example` to `.env` and fill in both values. Set the password before the first start: Postgres only reads it when it creates its volume. Compose refuses to start if either value is missing. The password must be letters and digits only, because it is placed inside a database URL.

```
docker compose up -d --build
docker compose logs -f scheduler
curl -i localhost:8000/companies/AAPL/overview     # first call: X-Cache MISS, second call: HIT
```

Look at the database:

```
docker compose exec database psql -U tickerlens -c "select kind, ticker, param from cache"
docker compose exec database psql -U tickerlens -c "select * from watchlist"
```

See what the scheduler is watching: `docker compose exec scheduler python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8002/watchlist').read().decode())"`

Delete all stored data: `docker compose down -v`

## Tests

Run from inside each service folder: `pip install -r requirements-dev.txt`, then `python -m pytest -v`.

- `central_api` and `scheduler`: offline. Their Postgres tests run only when `TEST_DATABASE_URL` is set, and they drop the tables they use, so point it at a throwaway database.
- `scrapper_api`: `tests/test_api.py` is offline. `tests/test_deployment.py` makes real calls against the running scrapper (set `API_URL` if it is not on localhost:8001).

## Things to know

- **Run one `scheduler` only.** Two would fetch everything twice.
- **Capacity:** each watched ticker costs the scheduler about 5 scrapper requests per 15 minutes (overview and 4 price ranges), plus 1 news request per hour. The scrapper turns an overview into 3 Finnhub calls and a news request into 1, and the four price ranges share one Yahoo download. The scheduler waits 1 second between scrapper requests, so roughly 100 tickers is the limit before one pass takes longer than 15 minutes. Finnhub's free plan (60 calls per minute) would allow about 250.
- **Yahoo** is an unofficial source with no published limits. It can rate-limit or block cloud IPs. If prices fail, check `docker compose logs scrapper`.
- **Copied code:** `app/models.py` in central is a copy of the scrapper's. The scheduler has its own small copies of the database and scrapper-call code, so each container stays independent. A change to the response shapes has to be made in the scrapper and in central.
- **Internal ports:** only the frontend is published to the network. `central` (8000), `scrapper` (8001) and `scheduler` (8002) are bound to 127.0.0.1 for debugging and the deployment tests, so the Finnhub quota is not open to the internet.