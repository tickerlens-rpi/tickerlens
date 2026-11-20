# TickerLens scraper API

A small FastAPI service that fetches stock data from outside providers. It has no database. The layer above it stores and caches results.

| Data | Source | Key needed |
|---|---|---|
| Overview (price, market cap, P/E, EPS, growth) | Finnhub | `FINNHUB_API_KEY` |
| News | Finnhub | `FINNHUB_API_KEY` |
| Price history | Yahoo Finance (`yfinance`) | none |

## Endpoints

| Method and path | Notes |
|---|---|
| `GET /health` | Returns `{"status": "ok"}` |
| `GET /companies/{ticker}/overview` | |
| `GET /companies/{ticker}/prices?range=1W\|1M\|1Y\|5Y` | Default `1M`. Points: 5 daily, 21 daily, 52 weekly, 260 weekly. |
| `GET /companies/{ticker}/news?limit=1..20` | Default `5`. Newest first, spread across at least two publishers when available. Publisher and link are the original outlet's (see below). |

Tickers are normalized, so `$aapl` becomes `AAPL` and `brk.b` becomes `BRK-B`.

| Status | Meaning |
|---|---|
| 404 | Unknown ticker |
| 422 | Bad query parameter |
| 502 | A provider failed or rate-limited (see the container logs) |
| 503 | `FINNHUB_API_KEY` is not set |

Interactive docs are at `/docs`.

## Setup

In the full project, `FINNHUB_API_KEY` lives in the root `.env` next to `docker-compose.yml` and compose passes it to this container. A free key is at https://finnhub.io.

## Run with Docker Compose

From the project root:

```
docker compose up -d --build scrapper
docker compose logs -f scrapper
```

Standalone, without compose:

```
docker build -t scrapper ./scrapper_api
docker run --rm -p 8001:8001 -e FINNHUB_API_KEY=your_key_here scrapper
```

## News publishers

Finnhub's `source` field is usually `Yahoo`, the feed it read, not the outlet that wrote the story. Its article link is a redirect to the original, so `app/news_links.py` requests that redirect (status and headers only, never the outlet's page) and `app/finnhub.py` names the publisher from the target's domain (`benzinga.com` → Benzinga; a table in `finnhub.py` covers common outlets) and uses the target as the link.

- Lookups share one pool of 4 workers across all requests, with at most 32 running or queued; resolved links are cached in memory.
- One news request spends at most 8 seconds on lookups (`RESOLVE_SECONDS`), so it stays under the central API's 30-second timeout.
- An article that cannot be resolved in time (Finnhub busy, rate-limited or slow) keeps the `Yahoo` label and Finnhub link. Network errors and 5xx are not cached, so the next request tries again.
- "Yahoo" and "Yahoo Finance" count as one publisher when spreading articles across publishers.

## Run locally

```
cd scrapper_api
pip install -r requirements.txt pytest ruff
$env:FINNHUB_API_KEY="your_key_here"     # PowerShell
uvicorn app.main:app --port 8001
```

## Tests

Run from `scrapper_api`:

```
python -m pytest tests/test_api.py -v                 # offline, no keys, no network
python -m pytest tests/test_deployment.py -v -s       # real calls against the running API
```

`test_deployment.py` uses `http://localhost:8001` unless `API_URL` is set. It skips itself if nothing is running there. It costs about 9 Finnhub calls (limit 60 per minute) and one Yahoo download.

## Limits

- Finnhub free tier: 60 calls per minute.
- Yahoo has no published limit. It can rate-limit or block cloud IPs, and `yfinance` is unofficial. This service downloads 5 years once per ticker and serves all four ranges from it for 5 minutes. If Yahoo fails, it serves the last copy it has.
- `last_updated` is the time of the response, not the time of the data.
- No caching beyond the Yahoo copy above and the resolved news links. Cache in the layer above.

## Swapping a provider

Each data source implements a small interface in `app/abstract_classes.py` (`OverviewProvider`, `PriceProvider`, `NewsProvider`). Write a new adapter and change `_build_provider()` in `app/main.py`.
