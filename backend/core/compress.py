import shutil
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
    # Set only by compress_to_target: whether the requested size was reached.
    target_met: Optional[bool] = None


def compress_pdf(
    source: Path,
    output: Path,
    compress_images: bool = False,
    image_dpi: int = 150,
    image_quality: int = 75,
    grayscale: bool = False,
) -> CompressResult:
    tmp = None
    original_source = source
    try:
        if not source.exists():
            return CompressResult(ok=False, error=f"File non trovato: {source}")
        original = source.stat().st_size
        output.parent.mkdir(parents=True, exist_ok=True)

        if compress_images or grayscale:
            tmp = output.with_name(output.stem + ".guloi_tmp.pdf")
            with pymupdf.open(str(source)) as doc:
                doc.rewrite_images(
                    dpi_threshold=image_dpi + 1,
                    dpi_target=image_dpi,
                    quality=image_quality,
                    lossy=True,
                    lossless=True,
                    set_to_gray=grayscale,
                )
                doc.save(str(tmp), garbage=3, deflate=True)
            source = tmp

        with pikepdf.open(str(source)) as pdf:
            # NIENTE normalize_content: è un'opzione di debug di qpdf che
            # scrive i content stream NON compressi — su PDF ricchi di testo
            # o vettoriale la "compressione" gonfiava il file.
            pdf.save(
                str(output),
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                compress_streams=True,
                recompress_flate=True,
            )

        # La compressione non deve mai peggiorare: se il risultato supera
        # l'originale (file già ottimizzato), consegna l'originale.
        if output.stat().st_size >= original:
            shutil.copyfile(str(original_source), str(output))
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


# Presets tried in order, from lightest to most aggressive. Quality/DPI are not
# independently monotonic when combined freely, so a precomputed ladder is used
# instead of a continuous search over two parameters — it is predictable and
# each step is a real, testable compress_pdf() call.
_TARGET_PRESETS = [
    dict(image_quality=75, image_dpi=150, grayscale=False),
    dict(image_quality=60, image_dpi=150, grayscale=False),
    dict(image_quality=40, image_dpi=120, grayscale=False),
    dict(image_quality=30, image_dpi=96, grayscale=False),
    dict(image_quality=20, image_dpi=72, grayscale=False),
    dict(image_quality=20, image_dpi=72, grayscale=True),
]


def compress_to_target(
    source: Path,
    output: Path,
    target_bytes: int,
) -> CompressResult:
    """Compress source, walking an increasingly aggressive preset ladder until
    the output is at or under target_bytes. Always returns the smallest result
    found; target_met tells the caller whether the target was actually hit.

    Starts from the lossless pass (no image recompression) since it is the
    best-quality outcome and is often already enough.
    """
    best: Optional[CompressResult] = None

    lossless = compress_pdf(source, output)
    if not lossless.ok:
        return lossless
    if lossless.compressed_size <= target_bytes:
        lossless.target_met = True
        return lossless
    best = lossless

    for i, preset in enumerate(_TARGET_PRESETS):
        candidate_path = output.with_name(f"{output.stem}.attempt{i}{output.suffix}")
        result = compress_pdf(source, candidate_path, compress_images=True, **preset)
        if not result.ok:
            continue
        if best is None or result.compressed_size < best.compressed_size:
            if best is not None and best.output_path and best.output_path != output:
                best.output_path.unlink(missing_ok=True)
            best = result
        else:
            candidate_path.unlink(missing_ok=True)
        if result.compressed_size <= target_bytes:
            break

    assert best is not None
    if best.output_path != output:
        best.output_path.replace(output)
        best.output_path = output
    best.target_met = best.compressed_size <= target_bytes
    return best
