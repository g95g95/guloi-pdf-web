import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Optional
from pypdf import PdfReader, PdfWriter


@dataclass
class MergeResult:
    ok: bool
    pages_written: int = 0
    output_path: Optional[Path] = None
    error: Optional[str] = None


def merge_pdfs(
    files: Iterable[Path],
    output: Path,
    progress_cb: Optional[Callable[[int, int], None]] = None,
) -> MergeResult:
    files = list(files)
    if not files:
        return MergeResult(ok=False, error="Lista file vuota")
    writer = PdfWriter()
    total = len(files)
    pages_written = 0
    try:
        for i, f in enumerate(files, 1):
            reader = PdfReader(str(f))
            for page in reader.pages:
                writer.add_page(page)
                pages_written += 1
            if progress_cb:
                progress_cb(i, total)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as fh:
            writer.write(fh)
        return MergeResult(ok=True, pages_written=pages_written, output_path=output)
    except Exception as e:
        return MergeResult(ok=False, error=str(e))


@dataclass
class SplitResult:
    ok: bool
    files_written: int = 0
    output_dir: Optional[Path] = None
    error: Optional[str] = None


def _parse_ranges(spec: str, max_page: int) -> list[list[int]]:
    """'1-3,5,7-9' -> [[1,2,3], [5], [7,8,9]]. Pagine 1-based."""
    groups = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(r"(\d+)-(\d+)", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if a < 1 or b > max_page or a > b:
                raise ValueError(f"Intervallo non valido: {part}")
            groups.append(list(range(a, b + 1)))
        elif part.isdigit():
            n = int(part)
            if n < 1 or n > max_page:
                raise ValueError(f"Pagina fuori range: {part}")
            groups.append([n])
        else:
            raise ValueError(f"Formato non valido: {part}")
    return groups


def split_pdf(
    source: Path,
    output_dir: Path,
    mode: str,
    value,
) -> SplitResult:
    try:
        reader = PdfReader(str(source))
        n = len(reader.pages)
        output_dir.mkdir(parents=True, exist_ok=True)
        if mode == "every":
            size = int(value)
            if size < 1:
                return SplitResult(ok=False, error="Valore 'every' deve essere >= 1")
            groups = [list(range(i, min(i + size, n + 1))) for i in range(1, n + 1, size)]
        elif mode == "ranges":
            groups = _parse_ranges(str(value), n)
        else:
            return SplitResult(ok=False, error=f"mode non supportato: {mode}")

        stem = source.stem
        written = 0
        for idx, pages in enumerate(groups, 1):
            w = PdfWriter()
            for p in pages:
                w.add_page(reader.pages[p - 1])
            out = output_dir / f"{stem}_part{idx:02d}.pdf"
            with open(out, "wb") as fh:
                w.write(fh)
            written += 1
        return SplitResult(ok=True, files_written=written, output_dir=output_dir)
    except Exception as e:
        return SplitResult(ok=False, error=str(e))


@dataclass
class RotateResult:
    ok: bool
    output_path: Optional[Path] = None
    error: Optional[str] = None


def rotate_pdf(source: Path, output: Path, rotations: dict) -> RotateResult:
    """rotations: {'all': 90} oppure {1: 90, 3: 180} (1-based). Valori in {90, 180, 270}."""
    try:
        for ang in rotations.values():
            if ang not in (90, 180, 270):
                return RotateResult(ok=False, error=f"Angolo non valido: {ang}")
        reader = PdfReader(str(source))
        writer = PdfWriter()
        all_rot = rotations.get("all")
        for i, page in enumerate(reader.pages, 1):
            if all_rot is not None:
                page.rotate(all_rot)
            elif i in rotations:
                page.rotate(rotations[i])
            writer.add_page(page)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as fh:
            writer.write(fh)
        return RotateResult(ok=True, output_path=output)
    except Exception as e:
        return RotateResult(ok=False, error=str(e))


@dataclass
class ExtractResult:
    ok: bool
    pages_written: int = 0
    output_path: Optional[Path] = None
    error: Optional[str] = None


def extract_pages(source: Path, output: Path, pages: str) -> ExtractResult:
    try:
        reader = PdfReader(str(source))
        n = len(reader.pages)
        groups = _parse_ranges(pages, n)
        writer = PdfWriter()
        count = 0
        for g in groups:
            for p in g:
                writer.add_page(reader.pages[p - 1])
                count += 1
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as fh:
            writer.write(fh)
        return ExtractResult(ok=True, pages_written=count, output_path=output)
    except Exception as e:
        return ExtractResult(ok=False, error=str(e))
