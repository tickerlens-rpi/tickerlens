# TickerLens central API

The single entry point between the frontend and every backend service, built
with FastAPI. Today it serves a small fixed set of companies from memory; the
database replaces that next.

## Getting started

Requires Python 3.11 or newer. Run everything from this folder.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Then open http://localhost:8000/docs for interactive documentation generated
from the code. The same schema is served as JSON at `/openapi.json`; it is the
contract the frontend builds against.

| Command                 | What it does                         |
| ----------------------- | ------------------------------------ |
| `pytest`                | Run the tests                        |
| `ruff check .`          | Lint with the Google style rules     |
| `ruff format .`         | Auto-format                          |
| `ruff format --check .` | Check formatting without changing it |

## Endpoints

| Endpoint                        | Returns                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `GET /health`                   | `{"status": "ok"}`                                        |
| `GET /companies/search?q=apple` | Matching companies, best first; an empty list for no hits |
| `GET /companies/{ticker}`       | One company's ticker, name and exchange; 404 if unknown   |

## Layout

| File                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `app/main.py`         | Builds the app, CORS, `/health`                                |
| `app/companies.py`    | The `/companies` routes                                        |
| `app/models.py`       | Response models, which define the API contract                 |
| `app/repositories.py` | `CompanyRepository` interface and its in-memory implementation |
| `app/dependencies.py` | Chooses which repository the routes receive                    |
| `app/sample_data.py`  | The fixed companies served until the database exists           |
| `app/tickers.py`      | Ticker normalisation, matching `frontend/src/lib/ticker.ts`    |

Routes depend only on the `CompanyRepository` interface. To move to the
database, add a class that implements it and return that class from
`get_company_repository` in `app/dependencies.py`; the routes and their tests
do not change.

## Configuration

| Variable                  | Default                 | Purpose                                         |
| ------------------------- | ----------------------- | ----------------------------------------------- |
| `TICKERLENS_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API |
