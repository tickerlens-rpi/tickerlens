# TickerLens frontend

The web client for TickerLens: the public landing page, the company
research page, where a reader searches for a company and gets its key
figures with explanations, a simplified price chart, an AI news summary with
the source behind every bullet, and the latest news, plus a chat, a
watchlist and settings.

## Pages

Routing uses React Router with real paths. Static hosts must serve
`index.html` for unknown paths (Cloudflare Pages does this when the build has
no `404.html`; the Docker image's nginx is configured for it).

| Route               | Page                                                         |
| ------------------- | ------------------------------------------------------------ |
| `/`                 | Landing page with the company search                         |
| `/company/:ticker`  | Company research: figures, chart, AI news summary, news      |
| `/research`         | Search for a company to research                             |
| `/research/:ticker` | Ask the connected AI about a ticker, add it to the watchlist |
| `/watchlist`        | Saved tickers with personal notes                            |
| `/settings`         | Connect Claude or ChatGPT, text size, delete local data      |

`/company/aapl` and `/company/$AAPL` redirect to `/company/AAPL`, and
`/research/aapl` to `/research/AAPL`.

## Bring your own AI, stored on the user's computer

TickerLens runs no AI on its servers. The news summary on the company page
and the chat on `/research/:ticker` use the reader's own AI, connected in
Settings in one of four ways: an **Anthropic (Claude)** API key, an
**OpenAI (ChatGPT)** API key, a **Google (Gemini)** API key, or a
**ChatGPT plan** sign-in.

The **news summary** (`src/lib/ai/news_summary.ts`) runs only when the reader
asks. The model gets up to eight of the latest articles, numbered, and must
answer with JSON: three to five bullets of at most 30 words, each citing one
article. Bullets that cite no real article are dropped, so every bullet shown
has a source tag. A summary is kept in `localStorage` for six hours. With the
sample client the summaries are the written sample ones instead.

For API keys:

- The key, model choice, watchlist and preferences are stored only in the
  browser (`localStorage`, or `sessionStorage` if the user picks "This tab
  only"). Every key starts with `tickerlens.` and Settings can wipe them all.
- Requests go straight from the browser to `api.anthropic.com` or
  `api.openai.com` through the official SDKs (`@anthropic-ai/sdk`, `openai`)
  with `dangerouslyAllowBrowser`, which is acceptable here because the key
  belongs to the person using the browser, not to us. Gemini requests go to
  `generativelanguage.googleapis.com` with plain `fetch`
  (`src/lib/ai/gemini_provider.ts`); the key is sent in the
  `x-goog-api-key` header, never in the URL.
- Production builds carry a Content-Security-Policy (`vite.config.ts`) whose
  `connect-src` allows only the site itself and those APIs, so a bug or a
  compromised dependency cannot quietly send the key elsewhere.
- The SDKs are loaded on demand (`src/lib/ai/chat.ts`), so the landing page
  does not download them.
- AI answers are rendered from a tiny Markdown subset into React elements
  (`src/lib/simple_markdown.ts`), never as HTML.

### Signing in with a ChatGPT plan (experimental)

This follows [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)'s
Codex sign-in. It is not an official OpenAI feature for other websites, so it
may stop working; Settings says so.

- Sign-in (`src/lib/ai/codex_auth.ts`) uses the device-code flow with
  Codex's public OAuth client: the page asks auth.openai.com for a code, the
  reader enters it at auth.openai.com/codex/device, and the page polls until
  it gets tokens. auth.openai.com accepts these requests from any site, so
  this happens entirely in the browser.
- Requests (`src/lib/ai/codex_provider.ts`) use the Responses API at
  chatgpt.com/backend-api/codex. chatgpt.com rejects requests from other
  sites, so they go to the same-origin relay `VITE_CODEX_RELAY_URL`
  (`/ai-proxy/codex`), which the Docker image's nginx and the Vite dev
  server provide. The relay forwards the request and stores nothing. Builds
  without a relay, such as Cloudflare Pages, hide the sign-in.
- Tokens are kept like an API key. They refresh an hour before they expire
  and after a 401. OpenAI rejects a reused refresh token, so new tokens are
  saved at once, under a cross-tab lock where the browser has one.
- The team server is plain HTTP, where browsers turn off
  `crypto.randomUUID`, `navigator.locks` and the clipboard API; the code has
  fallbacks for all three.

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

## Data

Pages never fetch on their own. They ask a `ResearchClient`
(`src/data/research.ts`), provided through React context, and the app picks
which one at build time:

| `VITE_API_BASE_URL`                  | Client                 | Where the data comes from                                                                      |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| not set (default)                    | `SampleResearchClient` | Made-up sample data bundled with the app. Works anywhere, including Cloudflare Pages previews. |
| `/api` (Docker image), or a full URL | `ApiResearchClient`    | The central API: search, figures, prices and news (`docs/CENTRAL_API_CONTRACT.md`).            |

To develop against a central API running on port 8000:

```bash
VITE_API_BASE_URL=/api npm run dev
```

The dev server forwards `/api` to `http://localhost:8000` (set
`TICKERLENS_API_TARGET` to use another address), just as nginx does in the
Docker image, so the browser only talks to one origin.

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

### API contract

The endpoints and JSON shapes are in
[docs/CENTRAL_API_CONTRACT.md](../docs/CENTRAL_API_CONTRACT.md).
`ApiResearchClient` turns the API's snake_case percentages into the camelCase
fractions in `src/data/research.ts`, keeps only http(s) article links, and
leaves out any figure the providers do not have. The pages show a dash for a
missing figure.

## Layout

```
src/
  main.tsx              Entry point: fonts, styles, text-size preference, render
  app.tsx               Research client, router, routes and the page frame
  pages/                One file per route (landing, company, research,
                        watchlist, settings, not found)
  sections/             Landing page sections, header, footer, research layout
  components/           Search, quote header, key figures, price chart,
                        news summary and source tags, news list, research
                        chat, AI connection form, watch button, term
                        explanations, text-size control, sample card
  data/                 ResearchClient interface, sample and API clients,
                        and the sample data itself (data/sample/)
  content/              Copy: landing content, key-figure explanations
  lib/                  Formatting, dates, chart scales, hooks, local
                        storage, watchlist, Markdown subset, prompts
  lib/ai/               AI connection storage, the Claude, OpenAI,
                        Gemini and ChatGPT-plan providers, ChatGPT sign-in, and the
                        news summary
  styles/               global.css (tokens), landing.css, research.css, app.css
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

## Docker

`Dockerfile` builds the app with `VITE_API_BASE_URL=/api` and
`VITE_CODEX_RELAY_URL=/ai-proxy/codex`, then serves `dist/` with nginx.
`nginx.conf` sends unknown paths to `index.html` for React Router, forwards
`/api/` to the central API, and relays `POST /ai-proxy/codex/responses` to
chatgpt.com. Run it with the rest of the stack from the repository root:
`docker compose up -d --build`.
