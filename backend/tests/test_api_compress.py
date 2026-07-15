def test_compress_endpoint_returns_pdf(client, tiny_pdf):
    src = tiny_pdf("big.pdf", pages=30)
    r = client.post(
        "/api/compress",
        files={"file": ("big.pdf", src.read_bytes(), "application/pdf")},
        data={"compress_images": "true"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert "attachment" in r.headers["content-disposition"]


def test_compress_endpoint_corrupt_pdf_returns_422(client):
    r = client.post("/api/compress", files={"file": ("x.pdf", b"%PDF-not really", "application/pdf")})
    assert r.status_code == 422
