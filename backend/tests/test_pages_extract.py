from core.pages import extract_pages, ExtractResult
from pypdf import PdfReader


def test_extract_specific_pages(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=10)
    out = tmp_path / "out.pdf"
    result = extract_pages(src, out, pages="1,3,5-7")
    assert result.ok is True
    assert result.pages_written == 5
    assert len(PdfReader(str(out)).pages) == 5


def test_extract_invalid_range(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=3)
    out = tmp_path / "out.pdf"
    result = extract_pages(src, out, pages="5-10")
    assert result.ok is False
