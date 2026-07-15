"""End-to-end "zero persistence" / no-leak guarantees.

THIS FILE IS THE TECHNICAL ENFORCEMENT OF THE /privacy PAGE.
The privacy page (frontend/src/locales/it.ts) promises the user two things:

  1. "I PDF che carichi vengono elaborati sul server in file temporanei e
     cancellati automaticamente al termine di ogni richiesta. Non vengono mai
     salvati." -> Tests 1 and 4: no temp-file residue after ANY request,
     including error paths and overlapping requests.

  2. "I log ... Non registrano mai nomi dei file né il loro contenuto." ->
     Test 2: no captured log record ever contains the uploaded filename or the
     file's embedded content. Test 3 additionally asserts responses never echo
     the uploaded filename.

These tests are written adversarially: they assume the backend might be lying
and try to catch it. If any assertion here is weakened, the corresponding
promise on the /privacy page MUST be weakened to match. Do not relax a test to
make it pass -- a failure here is a real privacy leak in the backend.
"""

import io
import logging
import tempfile
import threading

import pytest
from reportlab.pdfgen import canvas

from app import config


# --- markers embedded in the uploaded file to hunt for downstream ------------

FILENAME_MARKER = "SEGRETISSIMO_FORNITORE_XYZ.pdf"
# A distinctive string drawn INTO the PDF page stream (visible file content).
CONTENT_MARKER = "MARCATORE_CONTENUTO_RISERVATO_9F3K"


def _make_pdf_bytes(text=CONTENT_MARKER, pages=1):
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for i in range(pages):
        c.drawString(100, 750, f"{text} page {i + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


# A file that passes the %PDF- magic-byte gate but is not a parseable PDF, so
# the core layer returns ok=False -> 422. This exercises the error cleanup path.
CORRUPT_PDF = b"%PDF-1.4\n" + b"this is not a valid pdf body " * 20

# Non-PDF payload -> 415 (fails the magic-byte gate before any temp staging).
NON_PDF = b"just some plain text, definitely not a pdf"


def _valid_files_kwargs(marker_bytes):
    """`files=` kwargs for the single-file endpoints, using the marked PDF."""
    return {"file": (FILENAME_MARKER, marker_bytes, "application/pdf")}


# Each entry: (path, files_kwargs_fn, data) exercising the happy path.
# files_kwargs_fn(pdf_bytes) -> the `files=` argument for that endpoint.
def _endpoint_matrix():
    return [
        ("/api/compress", lambda b: {"files": (FILENAME_MARKER, b, "application/pdf")}, {}),
        (
            "/api/merge",
            lambda b: [
                ("files", (FILENAME_MARKER, b, "application/pdf")),
                ("files", ("secondo_" + FILENAME_MARKER, b, "application/pdf")),
            ],
            {},
        ),
        (
            "/api/split",
            lambda b: {"file": (FILENAME_MARKER, b, "application/pdf")},
            {"mode": "every", "value": "1"},
        ),
        (
            "/api/rotate",
            lambda b: {"file": (FILENAME_MARKER, b, "application/pdf")},
            {"angle": "90", "pages": ""},
        ),
        (
            "/api/extract",
            lambda b: {"file": (FILENAME_MARKER, b, "application/pdf")},
            {"pages": "1"},
        ),
        (
            "/api/password/set",
            lambda b: {"file": (FILENAME_MARKER, b, "application/pdf")},
            {"password": "secret123"},
        ),
        (
            "/api/password/remove",
            None,  # filled in per-test (needs an encrypted input)
            {"password": "secret123"},
        ),
        (
            # Hard-erase annotation so the pymupdf redaction path (extra
            # intermediate buffers) is exercised inside the watched tempdir.
            "/api/editor/save",
            lambda b: {"file": (FILENAME_MARKER, b, "application/pdf")},
            {
                "annotations": '[{"kind": "erase", "page": 0, '
                '"rect": [0, 0, 500, 800], "color": [1, 1, 1], "hard": true}]'
            },
        ),
    ]


@pytest.fixture
def fresh_tempdir(tmp_path, monkeypatch):
    """Point Python's tempfile machinery at a dedicated, initially-empty dir.

    TemporaryDirectory resolves the default lazily via tempfile.gettempdir(),
    which honours tempfile.tempdir when set. Setting it to our own dir means any
    temp file the backend creates lands here and we can prove the tree is empty
    after the request completes.
    """
    d = tmp_path / "leakcheck"
    d.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(d))
    # Defense in depth: pin the OS env vars too, so native code or subprocesses
    # that read TMP directly (bypassing tempfile) still land in the watched dir.
    for var in ("TMP", "TEMP", "TMPDIR"):
        monkeypatch.setenv(var, str(d))
    return d


def _tree_entries(d):
    return [p for p in d.rglob("*")]


# ---------------------------------------------------------------------------
# Test 1 -- no temp-file residue on every endpoint, happy AND error paths.
# ---------------------------------------------------------------------------


def test_no_temp_residue_happy_path_all_endpoints(client, fresh_tempdir):
    pdf = _make_pdf_bytes()
    # Build an encrypted PDF (staged through the fresh tempdir already) for the
    # password/remove happy path.
    enc = client.post(
        "/api/password/set",
        files={"file": (FILENAME_MARKER, pdf, "application/pdf")},
        data={"password": "secret123"},
    )
    assert enc.status_code == 200
    assert not _tree_entries(fresh_tempdir), "residue after password/set"

    for path, files_fn, data in _endpoint_matrix():
        if path == "/api/password/remove":
            files = {"file": (FILENAME_MARKER, enc.content, "application/pdf")}
        else:
            files = files_fn(pdf)
        r = client.post(path, files=files, data=data)
        assert r.status_code == 200, f"{path} happy path failed: {r.status_code} {r.text}"
        residue = _tree_entries(fresh_tempdir)
        assert not residue, f"temp residue after happy {path}: {residue}"


def test_no_temp_residue_corrupt_pdf_422_all_endpoints(client, fresh_tempdir):
    # Corrupt-but-magic-valid PDF passes the 415 gate, gets staged in a tempdir,
    # then the core layer fails -> 422. The staged temp files MUST still be gone.
    for path, files_fn, data in _endpoint_matrix():
        if path == "/api/merge":
            files = [
                ("files", (FILENAME_MARKER, CORRUPT_PDF, "application/pdf")),
                ("files", ("b_" + FILENAME_MARKER, CORRUPT_PDF, "application/pdf")),
            ]
        elif path == "/api/compress":
            files = {"files": (FILENAME_MARKER, CORRUPT_PDF, "application/pdf")}
        else:
            files = {"file": (FILENAME_MARKER, CORRUPT_PDF, "application/pdf")}
        r = client.post(path, files=files, data=data)
        assert r.status_code == 422, f"{path} expected 422, got {r.status_code}"
        residue = _tree_entries(fresh_tempdir)
        assert not residue, f"temp residue after corrupt {path}: {residue}"


def test_no_temp_residue_non_pdf_415(client, fresh_tempdir):
    # 415 happens before staging, but assert no residue regardless.
    r = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, NON_PDF, "application/pdf")},
    )
    assert r.status_code == 415
    assert not _tree_entries(fresh_tempdir)


def test_no_temp_residue_on_forced_500(client, fresh_tempdir, monkeypatch):
    # A crash mid-processing (after staging) must still tear down the tempdir.
    from app.routes import compress as compress_route

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(compress_route, "compress_pdf", boom)
    r = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, _make_pdf_bytes(), "application/pdf")},
    )
    assert r.status_code == 500
    residue = _tree_entries(fresh_tempdir)
    assert not residue, f"temp residue after forced 500: {residue}"


# ---------------------------------------------------------------------------
# Test 2 -- logs never contain filename or file content.
# ---------------------------------------------------------------------------


def test_logs_never_contain_user_data(client, caplog, monkeypatch):
    from app.routes import compress as compress_route

    pdf = _make_pdf_bytes()

    def _scan_records():
        for rec in caplog.records:
            msg = rec.getMessage()
            assert FILENAME_MARKER not in msg, f"filename leaked in log: {msg!r}"
            assert CONTENT_MARKER not in msg, f"content marker leaked in log: {msg!r}"
            # Raw uploaded bytes must never be rendered into a log line.
            assert CONTENT_MARKER.encode() not in msg.encode("utf-8", "replace")

    # Capture EVERY logger at DEBUG (uvicorn/fastapi included) with propagation.
    with caplog.at_level(logging.DEBUG):
        # Happy path.
        r = client.post(
            "/api/compress",
            files={"files": (FILENAME_MARKER, pdf, "application/pdf")},
        )
        assert r.status_code == 200
        _scan_records()

        # 422 path.
        r = client.post(
            "/api/compress",
            files={"files": (FILENAME_MARKER, CORRUPT_PDF, "application/pdf")},
        )
        assert r.status_code == 422
        _scan_records()

        # 500 path -- the handler MUST log (method+path) so the capture is not
        # vacuously empty, but still must not include user data.
        n_before = len(caplog.records)

        def boom(*a, **k):
            raise RuntimeError("internal boom with " + FILENAME_MARKER)

        monkeypatch.setattr(compress_route, "compress_pdf", boom)
        r = client.post(
            "/api/compress",
            files={"files": (FILENAME_MARKER, pdf, "application/pdf")},
        )
        assert r.status_code == 500
        _scan_records()

    # Prove the capture actually saw the 500 log line (not vacuously green) and
    # that it recorded method+path but not the filename.
    error_msgs = [
        r.getMessage()
        for r in caplog.records
        if r.levelno >= logging.ERROR and "/api/compress" in r.getMessage()
    ]
    assert error_msgs, "500 handler did not emit an observable log record"
    assert any("POST" in m and "/api/compress" in m for m in error_msgs)
    for m in error_msgs:
        assert FILENAME_MARKER not in m


# ---------------------------------------------------------------------------
# Test 3 -- response bodies never echo the uploaded filename.
# ---------------------------------------------------------------------------


def test_error_responses_never_echo_filename(client, monkeypatch):
    from app.routes import compress as compress_route

    pdf = _make_pdf_bytes()

    # 413 oversized (Content-Length lie), still carrying the marker filename.
    r413 = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, pdf, "application/pdf")},
        headers={"Content-Length": str(config.MAX_UPLOAD_BYTES + 1)},
    )
    assert r413.status_code == 413
    assert FILENAME_MARKER not in r413.text

    # 415 non-pdf.
    r415 = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, NON_PDF, "application/pdf")},
    )
    assert r415.status_code == 415
    assert FILENAME_MARKER not in r415.text

    # 422 corrupt.
    r422 = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, CORRUPT_PDF, "application/pdf")},
    )
    assert r422.status_code == 422
    assert FILENAME_MARKER not in r422.text

    # 500 forced.
    def boom(*a, **k):
        raise RuntimeError("boom " + FILENAME_MARKER)

    monkeypatch.setattr(compress_route, "compress_pdf", boom)
    r500 = client.post(
        "/api/compress",
        files={"files": (FILENAME_MARKER, pdf, "application/pdf")},
    )
    assert r500.status_code == 500
    assert FILENAME_MARKER not in r500.text


# ---------------------------------------------------------------------------
# Test 4 -- concurrency sanity: overlapping requests leave no residue.
# ---------------------------------------------------------------------------


def test_concurrent_requests_leave_no_residue(client, fresh_tempdir):
    # Two real overlapping requests via threads against the shared TestClient.
    # TestClient is thread-safe for concurrent calls; if this proves flaky on
    # Windows CI, the sequential loops in Test 1 already cover residue -- this
    # test specifically exercises the tempdir isolation under overlap.
    pdf = _make_pdf_bytes(pages=2)
    results = []

    def hit():
        r = client.post(
            "/api/split",
            files={"file": (FILENAME_MARKER, pdf, "application/pdf")},
            data={"mode": "every", "value": "1"},
        )
        results.append(r.status_code)

    threads = [threading.Thread(target=hit) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == [200, 200], results
    residue = _tree_entries(fresh_tempdir)
    assert not residue, f"temp residue after concurrent requests: {residue}"
