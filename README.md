# TickerLens

AI-assisted stock research for beginner and intermediate investors. TickerLens
turns market data, financial metrics, charts and company news into
plain-language research, and shows the source behind every claim.

> TickerLens is for research and education. It does not provide investment
> advice.

## Components

| Component   | Folder          | Purpose                                                                      |
| ----------- | --------------- | ---------------------------------------------------------------------------- |
| Frontend    | `frontend/`     | Landing page, company research page, AI chat, watchlist, settings (React)    |
| Central API | `central_api/`  | The only service the frontend calls: company search, overview, prices, news  |
| Scraper     | `scrapper_api/` | Fetches fresh data: overview and news from Finnhub, prices from Yahoo        |
| Scheduler   | `scheduler/`    | Keeps recently searched tickers fresh in the database                        |
| Database    | `database/`     | Postgres cache shared by the central API and the scheduler                   |

AI features (the news summary and the chat) run in the browser with each
user's own AI account, so the servers hold no AI keys. See
[frontend/README.md](frontend/README.md).

How the services fit together: [docs/backend_readme.md](docs/backend_readme.md).
The API contract the frontend relies on:
[docs/CENTRAL_API_CONTRACT.md](docs/CENTRAL_API_CONTRACT.md).

## Run everything with Docker (one command)

Requires Docker with Compose. Copy `.env.example` to `.env`, put your free
[Finnhub](https://finnhub.io/register) API key in it, then:

```bash
docker compose up -d --build
```

Open http://localhost (set `FRONTEND_PORT` in `.env` to use another port).
The frontend's nginx forwards `/api/` to the central API, so the browser only
ever talks to one origin.

## Run the frontend on its own

Requires Node.js 22.22 or newer (React Router 8 needs it).

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints (normally http://localhost:5173). Without a
backend the pages use labelled sample data. To use a central API running on
port 8000, start the dev server with `VITE_API_BASE_URL=/api npm run dev`;
Vite forwards `/api` to it.

Other useful commands, all run inside `frontend/`:

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run check`         | Lint, type-check and run the tests (what CI will run) |
| `npm test`              | Run the Vitest suite once                             |
| `npm run test:watch`    | Run tests in watch mode                               |
| `npm run test:coverage` | Run tests with a V8 coverage report                   |
| `npm run lint`          | ESLint with the Google style rules                    |
| `npm run fix`           | Auto-fix lint and formatting problems                 |
| `npm run build`         | Type-check and produce a production build in `dist/`  |

Each Python service has its own `README.md` with how to run it and its tests.

## Conventions

Code follows the Google style guides. See
[docs/CODING_CONVENTIONS.md](docs/CODING_CONVENTIONS.md) for what that means
in this repository and how it is enforced.

## Team

A software design project at Rensselaer Polytechnic Institute by Jiaying
Wang, Jialin (Gary) Fang, Alexander Cavoli, James Wu, and Nick Pillsbury.
Planning happens in Jira; code lives on GitHub.
