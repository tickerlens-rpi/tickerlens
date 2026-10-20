# TickerLens frontend

The web client for TickerLens: the public landing page and the company
research page, where a reader searches for a company and gets its key
figures with explanations, a simplified price chart, an AI news summary with
the source behind every bullet, and the latest news.

Stack: [Vite](https://vite.dev) 8, [React](https://react.dev) 19, TypeScript,
[Vitest](https://vitest.dev) + Testing Library, ESLint 10 with the Google
TypeScript Style rules, Prettier.

## Commands

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Start the dev server with hot reload                      |
| `npm run build`         | Type-check (`tsc -b`) and build for production to `dist/` |
| `npm run preview`       | Serve the production build locally                        |
| `npm test`              | Run the test suite once                                   |
| `npm run test:watch`    | Run tests in watch mode                                   |
| `npm run test:coverage` | Run tests with a V8 coverage report in `coverage/`        |
| `npm run lint`          | ESLint (Google style + Prettier as a lint rule)           |
| `npm run fix`           | Auto-fix lint and formatting problems                     |
| `npm run format`        | Prettier over everything, including CSS and Markdown      |
| `npm run typecheck`     | TypeScript only                                           |
| `npm run check`         | Lint, type-check and test                                 |

## Pages

| Address            | Page                                                |
| ------------------ | --------------------------------------------------- |
| `/`                | Landing page, with the company search in the hero   |
| `/company/:ticker` | Company research page, for example `/company/AAPL`  |
| anything else      | "Page not found", with a search box and a link home |

`/company/aapl` and `/company/$AAPL` redirect to `/company/AAPL`. Cloudflare
Pages serves `index.html` for any path it has no file for, so these addresses
work on preview deployments without extra configuration.

## Data

Pages never fetch on their own. They ask a `ResearchClient`
(`src/data/research.ts`), provided through React context, and the app picks
which one at build time:

| `VITE_API_BASE_URL`          | Client                 | Where the data comes from                                                                                |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| not set (default)            | `SampleResearchClient` | Made-up sample data bundled with the app. Works anywhere, including preview deployments with no backend. |
| e.g. `http://localhost:8000` | `ApiResearchClient`    | Company search and lookup from the central API; everything else still from the sample client.            |

To develop against the API, start it (see `../api/README.md`), then:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

The API allows `http://localhost:5173` by default. A deployed API needs the
site's address in its `TICKERLENS_CORS_ORIGINS`.

### Sample data

Every number, headline and summary the sample client serves is invented for
the prototype, and the company page says so in a notice at the top. The
companies match the API's sample list. AAPL and NKE follow the illustrative
numbers in the Sprint 1 user scenarios; AAPL, MSFT, NKE and TSLA have sample
news and summaries. The publishers ("Sample Wire", "Demo Daily", "Example
Ledger") are fictional on purpose, so no real outlet is credited with a story
it never ran, and every article links to example.com. Price histories come
from a seeded random walk (`src/lib/sample_prices.ts`), so they are the same
on every load.

### Proposed API endpoints

The API serves `GET /companies/search` and `GET /companies/{ticker}` today.
The company page also needs the endpoints below. Their response shapes are
the TypeScript types in `src/data/research.ts`; when the API adds one, switch
the matching `ApiResearchClient` method from the fallback to the API.

| Endpoint                                  | Returns                                                                                                     | Requirement |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| `GET /companies/{ticker}/overview`        | `Overview`: price, 1-day and 1-week change, market cap, EPS, P/E (absent on a loss), revenue growth, `asOf` | F2          |
| `GET /companies/{ticker}/prices?range=1M` | `PricePoint[]`, oldest first: daily closes up to `1Y`, weekly closes for `5Y`                               | F4          |
| `GET /companies/{ticker}/news`            | `NewsArticle[]`, newest first: headline, publisher, `publishedAt`, `url`                                    | F5          |
| `GET /companies/{ticker}/news-summary`    | `NewsSummary`: 3 to 5 bullets, each with its source article                                                 | F6, F7      |

## Layout

```
src/
  main.tsx              Entry point: fonts, styles, text-size preference, render
  app.tsx               Research client, router and routes
  pages/                Landing, company and not-found pages
  sections/             Landing page sections, headers, the research layout
  components/           Search, quote header, key figures, price chart,
                        news summary and source tags, news list, term
                        explanations, text-size control, sample card
  data/                 ResearchClient interface, sample and API clients,
                        and the sample data itself (data/sample/)
  content/              Copy: landing content, key-figure explanations
  lib/                  Formatting, dates, chart scales, hooks, helpers
  styles/               global.css (tokens), landing.css, research.css
  test/                 Vitest setup and the renderWithProviders helper
```

Tests live next to what they test as `*.test.ts(x)`. Files are `snake_case`
and everything is a named export; see
[docs/CODING_CONVENTIONS.md](../docs/CODING_CONVENTIONS.md).

## Design notes

The landing page is an "annotated ledger": warm paper, ink type, a teal accent
for anything explanatory and a highlighter yellow for the interaction the
product is built around. Dotted terms open a plain-language explanation, the
sample card's chart widens from one month to one year, and the header has a
text-size control (user story 8). All sizes are in `rem` so that control
scales the whole page. The sample company and its numbers are fictional and
labelled as such.

The company page keeps the same ledger: ruled key figures whose dotted labels
open an explanation, a teal margin rule beside the AI summary, and yellow
highlighter on whatever the reader has opened. The price chart is built to
be readable by everyone: one 2px line with no indicators, hairline solid
gridlines, a crosshair readout that also works from the keyboard (arrow
keys, Home, End), and a table view of every point. Its line colour
(`--series-price`) was checked with a palette validator for chroma and
contrast against the card surface; the brand teal itself reads too grey as a
data line. Text on the up and down change chips uses darker steps
(`--up-ink`, `--down-ink`) to pass WCAG AA.

Fonts (Fraunces, Instrument Sans, IBM Plex Mono) are self-hosted through
`@fontsource` packages, so the build has no runtime dependency on a fonts CDN.
That keeps a future container image self-contained.

## Containerising later

The app builds to static files in `dist/`, so the eventual Dockerfile is a
two-stage image: `node` to run `npm ci && npm run build`, then a static server
(nginx or similar) that serves `dist/`. Nothing in the app assumes a specific
host or port.
