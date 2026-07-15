from core.pages import rotate_pdf, RotateResult
from pypdf import PdfReader


def test_rotate_all_pages_90(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=3)
    out = tmp_path / "out.pdf"
    result = rotate_pdf(src, out, rotations={"all": 90})
    assert result.ok is True
    r = PdfReader(str(out))
    for page in r.pages:
        assert page.get("/Rotate") == 90


def test_rotate_specific_pages(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=4)
    out = tmp_path / "out.pdf"
    result = rotate_pdf(src, out, rotations={1: 90, 3: 180})
    assert result.ok is True
    r = PdfReader(str(out))
    assert r.pages[0].get("/Rotate") == 90
    assert r.pages[1].get("/Rotate") in (None, 0)
    assert r.pages[2].get("/Rotate") == 180
    assert r.pages[3].get("/Rotate") in (None, 0)


def test_rotate_invalid_angle(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1)
    result = rotate_pdf(src, tmp_path / "out.pdf", rotations={"all": 45})
    assert result.ok is False
    assert "angolo" in result.error.lower() or "45" in result.error
