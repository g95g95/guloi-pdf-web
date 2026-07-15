import os

import pymupdf
from PIL import Image

from core.compress import compress_pdf, CompressResult


def _image_heavy_pdf(tmp_path):
    img = Image.frombytes("RGB", (2400, 2400), os.urandom(2400 * 2400 * 3))
    img_path = tmp_path / "big.png"
    img.save(img_path)
    pdf_path = tmp_path / "scan.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_image(page.rect, filename=str(img_path))
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


def test_compress_images_shrinks_image_heavy_pdf(tmp_path):
    src = _image_heavy_pdf(tmp_path)
    lossless_out = tmp_path / "lossless.pdf"
    aggressive_out = tmp_path / "aggressive.pdf"

    lossless = compress_pdf(src, lossless_out)
    aggressive = compress_pdf(src, aggressive_out, compress_images=True)

    assert lossless.ok is True
    assert aggressive.ok is True
    assert aggressive.compressed_size < lossless.compressed_size
    assert aggressive.compressed_size < src.stat().st_size * 0.5
    with pymupdf.open(str(aggressive_out)) as doc:
        assert doc.page_count == 1


def test_compress_produces_smaller_or_equal(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=5)
    out = tmp_path / "compressed.pdf"
    original = src.stat().st_size
    result = compress_pdf(src, out)
    assert result.ok is True
    assert out.exists()
    assert result.original_size == original
    assert result.compressed_size > 0


def _text_heavy_pdf(tmp_path):
    """PDF con un content stream grosso NON compresso (come l'output editor)."""
    import pikepdf

    ops = b"BT /F1 8 Tf " + b" ".join(
        b"1 0 0 1 %d %d Tm (riga di testo numero %d) Tj" % (10 + i % 50, 800 - i % 700, i)
        for i in range(20000)
    ) + b" ET"
    pdf = pikepdf.new()
    page = pdf.add_blank_page(page_size=(595, 842))
    page.Contents = pdf.make_stream(ops)
    page.Resources = pikepdf.Dictionary(
        Font=pikepdf.Dictionary(
            F1=pikepdf.Dictionary(
                Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1,
                BaseFont=pikepdf.Name.Helvetica,
            )
        )
    )
    path = tmp_path / "testo.pdf"
    pdf.save(str(path), compress_streams=False)
    return path


def test_lossless_recompresses_raw_content_streams(tmp_path):
    """Regression: normalize_content=True scriveva i content stream NON
    compressi — su PDF pieni di testo la 'compressione' li gonfiava."""
    src = _text_heavy_pdf(tmp_path)
    out = tmp_path / "out.pdf"
    result = compress_pdf(src, out)
    assert result.ok is True
    assert result.compressed_size < result.original_size * 0.5, (
        f"content stream non ricompresso: {result.original_size} -> "
        f"{result.compressed_size}"
    )


def test_compress_never_returns_larger_file(tmp_path, tiny_pdf):
    """Se il 'compresso' è più grande dell'originale, tieni l'originale."""
    src = tiny_pdf("gia_ottimo.pdf", pages=1)
    out = tmp_path / "out.pdf"
    result = compress_pdf(src, out)
    assert result.ok is True
    assert result.compressed_size <= result.original_size


def test_compress_missing_source(tmp_path):
    out = tmp_path / "c.pdf"
    result = compress_pdf(tmp_path / "nope.pdf", out)
    assert result.ok is False
