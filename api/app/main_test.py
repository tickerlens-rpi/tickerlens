from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_schema_lists_the_company_routes():
    paths = client.get("/openapi.json").json()["paths"]

    assert "/companies/search" in paths
    assert "/companies/{ticker}" in paths


def test_cors_allows_the_vite_dev_server():
    response = client.get(
        "/health", headers={"Origin": "http://localhost:5173"}
    )

    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )
