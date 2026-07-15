import zipfile
import io

from pypdf import PdfReader


def test_merge_endpoint_returns_pdf(client, tiny_pdf):
    a = tiny_pdf("a.pdf", pages=2)
    b = tiny_pdf("b.pdf", pages=3)
    r = client.post(
        "/api/merge",
        files=[
            ("files", ("a.pdf", a.read_bytes(), "application/pdf")),
            ("files", ("b.pdf", b.read_bytes(), "application/pdf")),
        ],
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert "attachment" in r.headers["content-disposition"]
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 5


def test_merge_endpoint_requires_at_least_two_files(client, tiny_pdf):
    a = tiny_pdf("a.pdf", pages=1)
    r = client.post(
        "/api/merge",
        files=[("files", ("a.pdf", a.read_bytes(), "application/pdf"))],
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "Servono almeno 2 PDF"


def test_split_endpoint_returns_zip(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=4)
    r = client.post(
        "/api/split",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"mode": "every", "value": "2"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    assert "attachment" in r.headers["content-disposition"]
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = zf.namelist()
    assert len(names) >= 2
    for name in names:
        assert name.startswith("parte_")
        assert zf.read(name).startswith(b"%PDF")


def test_split_endpoint_invalid_mode_returns_422(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=2)
    r = client.post(
        "/api/split",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"mode": "bogus", "value": "2"},
    )
    assert r.status_code == 422


def test_rotate_endpoint_returns_pdf(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=3)
    r = client.post(
        "/api/rotate",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"angle": "90", "pages": ""},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(r.content))
    for page in reader.pages:
        assert page.get("/Rotate") == 90


def test_rotate_endpoint_invalid_angle_returns_422(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    r = client.post(
        "/api/rotate",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"angle": "45", "pages": ""},
    )
    assert r.status_code == 422


def test_extract_endpoint_returns_pdf(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=5)
    r = client.post(
        "/api/extract",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"pages": "1-2,4"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 3


def test_extract_endpoint_invalid_spec_returns_422(client, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=2)
    r = client.post(
        "/api/extract",
        files={"file": ("src.pdf", src.read_bytes(), "application/pdf")},
        data={"pages": "99-100"},
    )
    assert r.status_code == 422
