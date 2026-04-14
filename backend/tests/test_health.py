from fastapi.testclient import TestClient

from app.main import app

client: TestClient = TestClient(app)


def test_health_endpoint_returns_expected_payload() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Oroborous API is running",
        "status": "ok",
    }
