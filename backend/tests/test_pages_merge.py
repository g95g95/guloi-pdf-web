from core.pages import merge_pdfs, MergeResult
from pypdf import PdfReader


def test_merge_two_pdfs(tmp_path, tiny_pdf):
    a = tiny_pdf("a.pdf", pages=2, text="A")
    b = tiny_pdf("b.pdf", pages=3, text="B")
    out = tmp_path / "out.pdf"
    result = merge_pdfs([a, b], out)
    assert isinstance(result, MergeResult)
    assert result.ok is True
    assert result.pages_written == 5
    assert out.exists()
    assert len(PdfReader(str(out)).pages) == 5


def test_merge_progress_callback(tmp_path, tiny_pdf):
    a = tiny_pdf("a.pdf"); b = tiny_pdf("b.pdf"); c = tiny_pdf("c.pdf")
    out = tmp_path / "out.pdf"
    seen = []
    merge_pdfs([a, b, c], out, progress_cb=lambda done, total: seen.append((done, total)))
    assert seen[-1] == (3, 3)


def test_merge_empty_list_returns_error(tmp_path):
    out = tmp_path / "out.pdf"
    result = merge_pdfs([], out)
    assert result.ok is False
    assert "vuota" in result.error.lower() or "empty" in result.error.lower()
