# TickerLens

AI-assisted stock research for beginner and intermediate investors. TickerLens
turns market data, financial metrics, charts and company news into
plain-language research, and shows the source behind every claim.

> TickerLens is for research and education. It does not provide investment
> advice.

## Components

The vision document plans five components. Each one lives in its own folder
with its own dependencies so it can later be built into its own container and
wired together with a root `docker-compose.yml`.

| Component       | Folder        | Purpose                                                                   | Status      |
| --------------- | ------------- | ------------------------------------------------------------------------- | ----------- |
| Frontend        | `frontend/`   | Landing page today; the research dashboard (search, overview, AI panel) next | scaffolded |
| Central API     | `api/`        | Single entry point that connects the frontend to every service            | planned     |
| Scraper service | `scraper/`    | Pulls news, Reddit and financial-API data                                 | planned     |
| AI service      | `ai-service/` | Summarises news, explains metrics, extracts sentiment                     | planned     |
| Database        | `db/`         | Stores stock info, news, AI analysis and Reddit data                      | planned     |

## Getting started

Requires Node.js 22.12 or newer.

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints (normally http://localhost:5173).

Other useful commands, all run inside `frontend/`:

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run check`         | Lint, type-check and run the tests (what CI will run) |
| `npm test`              | Run the Vitest suite once                             |
| `npm run test:watch`    | Run tests in watch mode                               |
| `npm run test:coverage` | Run tests with a V8 coverage report                   |
| `npm run lint`          | ESLint with the Google style rules                    |
| `npm run fix`           | Auto-fix lint and formatting problems                 |
| `npm run build`         | Type-check and produce a production build in `dist/` |

## Conventions

Code follows the Google style guides. See
[docs/CODING_CONVENTIONS.md](docs/CODING_CONVENTIONS.md) for what that means
in this repository and how it is enforced.

## Team

A software design project at Rensselaer Polytechnic Institute by Jiaying
Wang, Jialin (Gary) Fang, Alexander Cavoli, James Wu, and Nick Pillsbury.
Planning happens in Jira; code lives on GitHub.
