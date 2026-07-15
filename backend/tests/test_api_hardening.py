from app import config
from app import middleware as mw

# The rate limiter is reset before each test by the autouse fixture in conftest.

# --- Requirement 1: 413 on oversized upload ---


def test_oversized_upload_content_length_returns_413(client, tiny_pdf):
    # A lying/large Content-Length header must be rejected up front.
    src = tiny_pdf("src.pdf", pages=1)
    big = config.MAX_UPLOAD_BYTES + 1
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src.read_bytes(), "application/pdf")},
        headers={"Content-Length": str(big)},
    )
    assert r.status_code == 413


def test_oversized_body_without_content_length_returns_413(client):
    # No/absent Content-Length must not bypass the byte enforcement on the body.
    payload = b"%PDF-" + b"0" * (config.MAX_UPLOAD_BYTES + 10)
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", payload, "application/pdf")},
    )
    assert r.status_code == 413


# --- Requirement 2: 415 on non-PDF ---


def test_non_pdf_upload_returns_415(client):
    r = client.post(
        "/api/compress",
        files={"files": ("x.pdf", b"not a pdf at all", "application/pdf")},
    )
    assert r.status_code == 415
    assert r.json()["detail"] == "Il file non è un PDF"


def test_merge_rejects_any_non_pdf_file(client, tiny_pdf):
    good = tiny_pdf("a.pdf", pages=1)
    r = client.post(
        "/api/merge",
        files=[
            ("files", ("a.pdf", good.read_bytes(), "application/pdf")),
            ("files", ("b.pdf", b"GARBAGE not pdf", "application/pdf")),
        ],
    )
    assert r.status_code == 415
    assert r.json()["detail"] == "Il file non è un PDF"


# --- Requirement 3: rate limiting ---


def test_rate_limit_returns_429_after_limit(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1).read_bytes()
    last = None
    for _ in range(config.RATE_LIMIT_MAX + 5):
        last = client.post(
            "/api/compress",
            files={"files": ("src.pdf", src, "application/pdf")},
        )
    assert last.status_code == 429
    assert last.json()["detail"] == "Troppe richieste, riprova tra poco"


def test_rate_limit_excludes_health(client):
    for _ in range(config.RATE_LIMIT_MAX + 20):
        r = client.get("/api/health")
        assert r.status_code == 200


def test_rate_limit_window_expires_with_injected_clock(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1).read_bytes()
    t = [1000.0]
    mw.rate_limiter.set_clock(lambda: t[0])
    try:
        for _ in range(config.RATE_LIMIT_MAX):
            r = client.post(
                "/api/compress", files={"files": ("src.pdf", src, "application/pdf")}
            )
            assert r.status_code == 200
        r = client.post(
            "/api/compress", files={"files": ("src.pdf", src, "application/pdf")}
        )
        assert r.status_code == 429
        # advance past the window
        t[0] += config.RATE_LIMIT_WINDOW_S + 1
        r = client.post(
            "/api/compress", files={"files": ("src.pdf", src, "application/pdf")}
        )
        assert r.status_code == 200
    finally:
        mw.rate_limiter.set_clock(None)


def test_rate_limit_key_uses_xff_first_hop(client, tiny_pdf):
    # Behind Render's proxy every request shares request.client.host; buckets
    # must be keyed on the first hop of X-Forwarded-For instead.
    src = tiny_pdf("src.pdf", pages=1).read_bytes()
    for _ in range(config.RATE_LIMIT_MAX):
        r = client.post(
            "/api/compress",
            files={"files": ("src.pdf", src, "application/pdf")},
            headers={"X-Forwarded-For": "1.1.1.1"},
        )
        assert r.status_code == 200
    # Same first hop (extra proxy hops appended) -> same bucket, now full.
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src, "application/pdf")},
        headers={"X-Forwarded-For": "1.1.1.1, 10.0.0.1"},
    )
    assert r.status_code == 429
    # Different client IP -> separate bucket.
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src, "application/pdf")},
        headers={"X-Forwarded-For": "2.2.2.2"},
    )
    assert r.status_code == 200
    # No header -> falls back to request.client.host, still works.
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src, "application/pdf")},
    )
    assert r.status_code == 200


def test_rate_limiter_prunes_idle_keys_after_window(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1).read_bytes()
    t = [1000.0]
    mw.rate_limiter.set_clock(lambda: t[0])
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src, "application/pdf")},
        headers={"X-Forwarded-For": "1.1.1.1"},
    )
    assert r.status_code == 200
    assert "1.1.1.1" in mw.rate_limiter._hits
    t[0] += config.RATE_LIMIT_WINDOW_S + 1
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src, "application/pdf")},
        headers={"X-Forwarded-For": "2.2.2.2"},
    )
    assert r.status_code == 200
    assert "1.1.1.1" not in mw.rate_limiter._hits


def test_rate_limiter_caps_tracked_keys():
    rl = mw.SlidingWindowRateLimiter()
    for i in range(mw.MAX_TRACKED_KEYS + 50):
        assert rl.allow(f"ip-{i}")
    assert len(rl._hits) <= mw.MAX_TRACKED_KEYS


# --- Requirement 4: global error handler ---


def test_unhandled_exception_returns_generic_500(client, tiny_pdf, monkeypatch):
    from app.routes import compress as compress_route

    def boom(*a, **k):
        raise RuntimeError("secret internal detail /home/user/file.pdf")

    monkeypatch.setattr(compress_route, "compress_pdf", boom)
    src = tiny_pdf("src.pdf", pages=1)
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src.read_bytes(), "application/pdf")},
    )
    assert r.status_code == 500
    assert r.json() == {"detail": "Errore interno"}
    assert "secret internal detail" not in r.text
    assert "RuntimeError" not in r.text


# --- Requirement 5: processing timeout ---


def test_processing_timeout_returns_504(client, tiny_pdf, monkeypatch):
    import time

    from app.routes import compress as compress_route

    monkeypatch.setattr(config, "PROCESS_TIMEOUT_S", 0.05)

    def slow(*a, **k):
        time.sleep(1.0)
        raise AssertionError("should have timed out")

    monkeypatch.setattr(compress_route, "compress_pdf", slow)
    src = tiny_pdf("src.pdf", pages=1)
    r = client.post(
        "/api/compress",
        files={"files": ("src.pdf", src.read_bytes(), "application/pdf")},
    )
    assert r.status_code == 504
    assert r.json()["detail"] == "Elaborazione troppo lunga, riprova"
