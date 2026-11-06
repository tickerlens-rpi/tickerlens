# TickerLens

AI-assisted stock research for beginner and intermediate investors. TickerLens
turns market data, financial metrics, charts and company news into
plain-language research, and shows the source behind every claim.

> TickerLens is for research and education. It does not provide investment
> advice.

## Components

| Component       | Folder          | Purpose                                                                      | Status     |
| --------------- | --------------- | ---------------------------------------------------------------------------- | ---------- |
| Frontend        | `frontend/`     | Landing page today; the research dashboard (search, overview, AI panel) next | scaffolded |
| Market data API | `scrapper_api/` | Serves prices, company overviews and news from Alpha Vantage                 | active     |
| AI service      | `ai-service/`   | Summarises news, explains metrics, extracts sentiment                        | planned    |

The API calls Alpha Vantage directly and does not persist responses.

## Getting started

Requires Node.js 22.22 or newer (React Router 8 needs it).

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
| `npm run build`         | Type-check and produce a production build in `dist/`  |

### Market data API

Set `ALPHAVANTAGE_API_KEY` in your environment, then run the API from
`scrapper_api/`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

See [scrapper_api/README.md](scrapper_api/README.md) for endpoints and
configuration. The API is also available on port 8001 when started with
`docker compose up --build`.

## Conventions

Code follows the Google style guides. See
[docs/CODING_CONVENTIONS.md](docs/CODING_CONVENTIONS.md) for what that means
in this repository and how it is enforced.

## Team

A software design project at Rensselaer Polytechnic Institute by Jiaying
Wang, Jialin (Gary) Fang, Alexander Cavoli, James Wu, and Nick Pillsbury.
Planning happens in Jira; code lives on GitHub.
