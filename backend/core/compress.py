from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import pikepdf
import pymupdf


@dataclass
class CompressResult:
    ok: bool
    original_size: int = 0
    compressed_size: int = 0
    output_path: Optional[Path] = None
    error: Optional[str] = None


def compress_pdf(
    source: Path,
    output: Path,
    compress_images: bool = False,
    image_dpi: int = 150,
    image_quality: int = 75,
) -> CompressResult:
    tmp = None
    try:
        if not source.exists():
            return CompressResult(ok=False, error=f"File non trovato: {source}")
        original = source.stat().st_size
        output.parent.mkdir(parents=True, exist_ok=True)

        if compress_images:
            tmp = output.with_name(output.stem + ".guloi_tmp.pdf")
            with pymupdf.open(str(source)) as doc:
                doc.rewrite_images(
                    dpi_threshold=image_dpi + 1,
                    dpi_target=image_dpi,
                    quality=image_quality,
                    lossy=True,
                    lossless=True,
                )
                doc.save(str(tmp), garbage=3, deflate=True)
            source = tmp

        with pikepdf.open(str(source)) as pdf:
            pdf.save(
                str(output),
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                compress_streams=True,
                normalize_content=True,
            )
        return CompressResult(
            ok=True,
            original_size=original,
            compressed_size=output.stat().st_size,
            output_path=output,
        )
    except Exception as e:
        return CompressResult(ok=False, error=str(e))
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)
