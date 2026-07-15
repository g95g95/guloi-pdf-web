from core.pages import split_pdf, SplitResult
from pypdf import PdfReader


def test_split_every_n_pages(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=6)
    out_dir = tmp_path / "out"
    result = split_pdf(src, out_dir, mode="every", value=2)
    assert isinstance(result, SplitResult)
    assert result.ok is True
    assert result.files_written == 3
    files = sorted(out_dir.glob("*.pdf"))
    assert len(files) == 3
    for f in files:
        assert len(PdfReader(str(f)).pages) == 2


def test_split_by_ranges(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=10)
    out_dir = tmp_path / "out"
    result = split_pdf(src, out_dir, mode="ranges", value="1-3,5,7-9")
    assert result.ok is True
    assert result.files_written == 3
    files = sorted(out_dir.glob("*.pdf"))
    pages_per = [len(PdfReader(str(f)).pages) for f in files]
    assert sorted(pages_per) == [1, 3, 3]


def test_split_invalid_mode_returns_error(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=3)
    result = split_pdf(src, tmp_path / "out", mode="invalid", value=1)
    assert result.ok is False
    assert "mode" in result.error.lower()
