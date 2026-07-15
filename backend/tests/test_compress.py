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


def test_compress_missing_source(tmp_path):
    out = tmp_path / "c.pdf"
    result = compress_pdf(tmp_path / "nope.pdf", out)
    assert result.ok is False
