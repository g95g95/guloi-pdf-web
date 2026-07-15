import zipfile
from io import BytesIO


def test_compress_endpoint_returns_pdf(client, tiny_pdf):
    src = tiny_pdf("big.pdf", pages=30)
    r = client.post(
        "/api/compress",
        files={"files": ("big.pdf", src.read_bytes(), "application/pdf")},
        data={"compress_images": "true"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert "attachment" in r.headers["content-disposition"]


def test_compress_endpoint_corrupt_pdf_returns_422(client):
    r = client.post("/api/compress", files={"files": ("x.pdf", b"%PDF-not really", "application/pdf")})
    assert r.status_code == 422


def test_compress_endpoint_target_mb_sets_header(client, tiny_pdf):
    src = tiny_pdf("big.pdf", pages=30)
    r = client.post(
        "/api/compress",
        files={"files": ("big.pdf", src.read_bytes(), "application/pdf")},
        data={"target_mb": "10"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["x-target-met"] == "true"


def test_compress_endpoint_target_mb_invalid_returns_422(client, tiny_pdf):
    src = tiny_pdf("small.pdf", pages=1)
    r = client.post(
        "/api/compress",
        files={"files": ("small.pdf", src.read_bytes(), "application/pdf")},
        data={"target_mb": "0"},
    )
    assert r.status_code == 422


def test_compress_endpoint_multiple_files_returns_zip(client, tiny_pdf):
    a = tiny_pdf("a.pdf", pages=3)
    b = tiny_pdf("b.pdf", pages=5)
    r = client.post(
        "/api/compress",
        files=[
            ("files", ("a.pdf", a.read_bytes(), "application/pdf")),
            ("files", ("b.pdf", b.read_bytes(), "application/pdf")),
        ],
        data={"compress_images": "true"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    assert "compressi.zip" in r.headers["content-disposition"]
    with zipfile.ZipFile(BytesIO(r.content)) as zf:
        names = zf.namelist()
        assert names == ["compresso_01.pdf", "compresso_02.pdf"]
        for name in names:
            assert zf.read(name).startswith(b"%PDF")


def test_compress_endpoint_multiple_files_target_marks_unmet(client, tiny_pdf):
    a = tiny_pdf("a.pdf", pages=1)
    r = client.post(
        "/api/compress",
        files=[
            ("files", ("a.pdf", a.read_bytes(), "application/pdf")),
            ("files", ("b.pdf", a.read_bytes(), "application/pdf")),
        ],
        data={"target_mb": "10"},
    )
    assert r.status_code == 200
    assert r.headers["x-target-met"] == "true"
    with zipfile.ZipFile(BytesIO(r.content)) as zf:
        assert zf.namelist() == ["compresso_01.pdf", "compresso_02.pdf"]
