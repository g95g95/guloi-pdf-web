import pytest
from pathlib import Path
from reportlab.pdfgen import canvas
from fastapi.testclient import TestClient

from app.main import app
from app import middleware as _mw


@pytest.fixture(scope="session")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Keep per-test request counts from bleeding across the shared client."""
    _mw.rate_limiter.reset()
    _mw.rate_limiter.set_clock(None)
    yield


@pytest.fixture
def tiny_pdf(tmp_path):
    def _make(name="tiny.pdf", pages=1, text="hello"):
        p = tmp_path / name
        c = canvas.Canvas(str(p))
        for i in range(pages):
            c.drawString(100, 750, f"{text} page {i+1}")
            c.showPage()
        c.save()
        return p
    return _make
