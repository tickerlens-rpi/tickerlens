# TickerLens frontend

The web client for TickerLens. Right now it is the public landing page; the
research dashboard (ticker search, simplified overview, AI summaries, charts)
will be built in the same app once the central API exists.

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
  app.tsx               Page shell (header, sections, footer)
  components/           Reusable pieces: term explanations, ticker search,
                        text-size control, sample overview card, sparkline
  sections/             One file per landing page section
  content/              Copy and data lifted from the vision document
  lib/                  Framework-free helpers with unit tests
  styles/               global.css (tokens, reset) and landing.css (layout)
  test/setup.ts         Vitest setup (jest-dom matchers, cleanup)
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
