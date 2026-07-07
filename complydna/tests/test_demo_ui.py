from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_root_redirects_to_demo() -> None:
    client = TestClient(app, follow_redirects=False)
    response = client.get("/")
    assert response.status_code == 307
    assert response.headers["location"] == "/demo/"


def test_demo_ui_is_served() -> None:
    client = TestClient(app)
    response = client.get("/demo/")
    assert response.status_code == 200
    assert "ComplyDNA" in response.text
    assert "kaynak modu: açık" in response.text


def test_demo_static_assets() -> None:
    client = TestClient(app)
    for path in ("/demo/styles.css", "/demo/app.js"):
        response = client.get(path)
        assert response.status_code == 200
