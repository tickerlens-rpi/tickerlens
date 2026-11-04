# TickerLens frontend

The web client for TickerLens: the public landing page plus the app pages.
Live market data (prices, charts, news) arrives once the central API exists;
until then the research page answers questions with the user's own AI model.

## Pages

Routing is hash-based (`src/lib/router.ts`), so the build works from any
static host without rewrite rules. Hashes that do not start with `#/` stay
in-page anchors on the landing page.

| Route                 | Page                                                            |
| --------------------- | --------------------------------------------------------------- |
| `#/`                  | Landing page                                                    |
| `#/research/<TICKER>` | Research: ask the connected AI about a ticker, add to watchlist |
| `#/watchlist`         | Saved tickers with personal notes                               |
| `#/settings`          | Connect Claude or ChatGPT, text size, delete local data         |

## Bring your own AI, stored on the user's computer

Users connect their own **Anthropic (Claude)** or **OpenAI (ChatGPT)** API key
in Settings. The design rule is that a TickerLens server never handles it:

- The key, model choice, watchlist and preferences are stored only in the
  browser (`localStorage`, or `sessionStorage` if the user picks "This tab
  only"). Every key starts with `tickerlens.` and Settings can wipe them all.
- Requests go straight from the browser to `api.anthropic.com` or
  `api.openai.com` through the official SDKs (`@anthropic-ai/sdk`, `openai`)
  with `dangerouslyAllowBrowser`, which is acceptable here because the key
  belongs to the person using the browser, not to us.
- Production builds carry a Content-Security-Policy (`vite.config.ts`) whose
  `connect-src` allows only the site itself and those two APIs, so a bug or a
  compromised dependency cannot quietly send the key elsewhere. Add the
  central API's origin there when it exists.
- The SDKs are loaded on demand (`src/lib/ai/chat.ts`), so the landing page
  does not download them.
- AI answers are rendered from a tiny Markdown subset into React elements
  (`src/lib/simple_markdown.ts`), never as HTML.

Consumer subscriptions (ChatGPT Plus, Claude Pro/Max) cannot be used: neither
company offers a way for third-party websites to sign in with them, so API
keys, billed per use, are the supported route. Settings explains this to
users.

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

## Layout

```
src/
  main.tsx              Entry point: fonts, styles, text-size preference, render
  app.tsx               Shell: header, routed page, footer; focus on navigation
  pages/                One file per route (landing, research, watchlist,
                        settings, not found)
  components/           Reusable pieces: ticker search, research chat, AI
                        connection form, watch button, term explanations,
                        text-size control, sample overview card, sparkline
  sections/             Landing page sections, header and footer
  content/              Copy and data lifted from the vision document
  lib/                  Helpers with unit tests: router, local storage,
                        watchlist, Markdown subset, prompts
  lib/ai/               AI connection storage and the Claude/OpenAI providers
  styles/               global.css (tokens, reset), landing.css, app.css
  test/setup.ts         Vitest setup (jest-dom, cleanup, storage reset)
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

Fonts (Fraunces, Instrument Sans, IBM Plex Mono) are self-hosted through
`@fontsource` packages, so the build has no runtime dependency on a fonts CDN.
That keeps a future container image self-contained.

## Containerising later

The app builds to static files in `dist/`, so the eventual Dockerfile is a
two-stage image: `node` to run `npm ci && npm run build`, then a static server
(nginx or similar) that serves `dist/`. Nothing in the app assumes a specific
host or port.
