import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def static_dir(tmp_path):
    d = tmp_path / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<html><body>guloi-pdf spa</body></html>", encoding="utf-8")
    (d / "assets" / "app.js").write_text("console.log('app');", encoding="utf-8")
    (d / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")
    return d


@pytest.fixture
def app_with_static(monkeypatch, static_dir):
    """Build a fresh app instance with GULOI_STATIC_DIR pointed at a fake dist dir."""
    monkeypatch.setenv("GULOI_STATIC_DIR", str(static_dir))

    from app import config as config_module
    from app import main as main_module

    importlib.reload(config_module)
    importlib.reload(main_module)

    app = main_module.create_app()
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    finally:
        # Restore modules to their non-static state for subsequent tests.
        monkeypatch.delenv("GULOI_STATIC_DIR", raising=False)
        importlib.reload(config_module)
        importlib.reload(main_module)


def test_root_serves_index_html(app_with_static):
    response = app_with_static.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "guloi-pdf spa" in response.text


def test_spa_fallback_serves_index_html_for_deep_link(app_with_static):
    response = app_with_static.get("/comprimi")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "guloi-pdf spa" in response.text


def test_assets_are_served_with_long_cache_headers(app_with_static):
    response = app_with_static.get("/assets/app.js")
    assert response.status_code == 200
    assert "console.log" in response.text
    assert "max-age" in response.headers.get("cache-control", "")


def test_root_level_static_file_is_served_directly(app_with_static):
    response = app_with_static.get("/favicon.svg")
    assert response.status_code == 200
    assert "<svg>" in response.text


def test_path_traversal_outside_static_dir_falls_back_to_index(app_with_static):
    response = app_with_static.get("/..%2f..%2fetc%2fpasswd")
    assert response.status_code in (200, 404)
    # Whatever status, it must not leak filesystem content outside static_dir.
    assert "root:" not in response.text


def test_unknown_api_path_returns_json_404_not_html(app_with_static):
    response = app_with_static.get("/api/nonexistent")
    assert response.status_code == 404
    assert "application/json" in response.headers["content-type"]


def test_health_still_works_with_static_mounted(app_with_static):
    response = app_with_static.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_existing_suite_stays_green_when_static_dir_absent(client):
    """Sanity check: default app (no GULOI_STATIC_DIR) still serves the API normally."""
    response = client.get("/api/health")
    assert response.status_code == 200
    response = client.get("/api/nonexistent")
    assert response.status_code == 404
    assert "application/json" in response.headers["content-type"]
