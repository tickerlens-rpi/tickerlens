# Central API: frontend contract

The frontend calls these read-only GET endpoints on central at `http://localhost:8000` (`http://central:8000` from inside docker compose). In the browser they live under `/api` on the frontend's own origin: the frontend container's nginx and the Vite dev server forward `/api/...` to central. Every response is JSON.

## Endpoints

| Method & path | Query params | Returns |
| --- | --- | --- |
| `GET /companies/search` | `q` = name or ticker, 1 to 64 characters; `limit` = 1 to 20 (default 8) | CompanySearchResults |
| `GET /companies/{ticker}` | none | Company |
| `GET /companies/{ticker}/overview` | none | Overview |
| `GET /companies/{ticker}/prices` | `range` = `1W`, `1M`, `1Y` or `5Y` (default `1M`) | PricesResponse |
| `GET /companies/{ticker}/news` | `limit` = 1 to 20 (default 5) | NewsResponse |
| `GET /health` | none | `{"status": "ok"}` |

Tickers are forgiving: `aapl`, `AAPL`, `$AAPL` and `brk.b` (becomes `BRK-B`) all work. Anything that is not 1 to 10 letters, digits or dashes returns 422.

## Types (TypeScript)

```ts
interface Company {
  ticker: string;                     // e.g. "AAPL", "BRK-B"
  name: string;                       // e.g. "Apple Inc."
  exchange: "NYSE" | "NASDAQ";
}
interface CompanySearchResults {
  query: string;                      // the search text as received
  results: Company[];                 // best match first; [] when nothing matches
}
interface Overview {
  ticker: string;
  name: string;
  exchange: string | null;
  price: number;                      // USD
  change_1d_pct: number | null;       // percent, 1.2 means +1.2%
  change_1w_pct: number | null;
  market_cap: number | null;          // integer, USD
  pe_ratio: number | null;
  eps: number | null;
  revenue_growth_pct: number | null;  // percent
  last_updated: string;               // ISO 8601 UTC
}
interface PricesResponse {
  ticker: string;
  range: "1W" | "1M" | "1Y" | "5Y";
  points: { date: string; close: number }[];  // oldest first, date = YYYY-MM-DD
  last_updated: string;
}
interface NewsResponse {
  ticker: string;
  articles: {
    headline: string;
    publisher: string | null;
    published_at: string | null;
    url: string;
    summary: string | null;
  }[];                                // newest first
  last_updated: string;
}
```

Fields typed `| null` can be null, so render a dash. Point counts are about 5 (1W), 21 (1M), 52 (1Y, weekly) and 260 (5Y, weekly).

## Sample responses

`GET /companies/search?q=apple&limit=2`

```json
{"query":"apple","results":[{"ticker":"AAPL","name":"Apple Inc.","exchange":"NASDAQ"},{"ticker":"APLE","name":"Apple Hospitality REIT, Inc.","exchange":"NYSE"}]}
```

`GET /companies/AAPL/overview`

```json
{"ticker":"AAPL","name":"Apple Inc","exchange":"NASDAQ","price":231.45,"change_1d_pct":1.2,"change_1w_pct":-0.8,"market_cap":3400000000000,"pe_ratio":34.8,"eps":6.65,"revenue_growth_pct":6.1,"last_updated":"2026-11-05T21:21:13.751484Z"}
```

`GET /companies/AAPL/prices?range=1W`

```json
{"ticker":"AAPL","range":"1W","points":[{"date":"2026-10-30","close":228.1},{"date":"2026-10-31","close":229.7}],"last_updated":"2026-11-05T21:21:14.102331Z"}
```

`GET /companies/AAPL/news?limit=1`

```json
{"ticker":"AAPL","articles":[{"headline":"Apple unveils new chip","publisher":"Reuters","published_at":"2026-11-05T14:30:00Z","url":"https://example.com/story","summary":"Short summary text."}],"last_updated":"2026-11-05T21:21:14.4Z"}
```

Values are illustrative; the shapes are exactly what central returns.

## Errors

All errors are `{"detail": ...}` with a status code.

| Status | Body | Meaning |
| --- | --- | --- |
| 404 | `{"detail":"No data for that ticker."}` | Unknown ticker, show "not found" |
| 404 | `{"detail":"No company found for that ticker."}` | `GET /companies/{ticker}` for a ticker not listed on NYSE or NASDAQ |
| 422 | `{"detail":"Not a valid ticker."}` | Malformed ticker |
| 422 | FastAPI list-style `detail` | Bad `range` or `limit` |
| 502 | `{"detail":"Market data is temporarily unavailable."}` | Upstream down and nothing cached, offer retry |

## Sample queries

```bash
curl http://localhost:8000/companies/AAPL/overview
curl "http://localhost:8000/companies/AAPL/prices?range=1Y"
curl "http://localhost:8000/companies/AAPL/news?limit=10"
curl -i http://localhost:8000/companies/AAPL/overview   # shows the X-Cache header
```

```ts
const BASE = "http://localhost:8000";

async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
  return r.json();
}

const [overview, prices, news] = await Promise.all([
  api<Overview>("/companies/AAPL/overview"),
  api<PricesResponse>("/companies/AAPL/prices?range=1M"),
  api<NewsResponse>("/companies/AAPL/news?limit=5"),
]);
```

## Things to know

- Every response has an `X-Cache` header: `HIT` (from the database), `MISS` (just fetched) or `STALE` (old data served because the refresh failed).
- `last_updated` is when the data was fetched, not when the market moved. Data is refreshed after 15 min (overview, prices) or 1 hour (news).
- The first request for a new ticker is slow because central calls the scraper. Use a client timeout of 30 s or more and fire the three requests in parallel.
- Searching a ticker makes the backend keep it fresh for a week, so repeat visits are fast.
- CORS is not enabled. A browser app on another origin is blocked, so either proxy `/api` through the frontend's nginx or dev server, or ask the backend to add CORS middleware.
- Search and company lookup use a bundled list of about 5,600 NYSE and NASDAQ companies (`central_api/app/data/companies.csv`), so they never call the scraper. Refresh the list with `python scripts/build_company_list.py` from `central_api/`.
- Search ranks an exact ticker first, then ticker prefixes, then names that start with the query, then names containing a word that starts with it. A query with no matches returns `200` with an empty `results` list.
