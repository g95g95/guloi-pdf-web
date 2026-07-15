from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Optional

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas as rl_canvas

from editor.annotations import (
    DrawAnnotation, HighlightAnnotation, SignatureAnnotation, TextAnnotation,
    EraseAnnotation, TextEditAnnotation, FormFieldAnnotation,
)
from editor.document_state import DocumentState


@dataclass
class SaveResult:
    ok: bool
    output_path: Optional[Path] = None
    error: Optional[str] = None


def save_document(state: DocumentState, output: Path) -> SaveResult:
    try:
        if state.source is None:
            return SaveResult(ok=False, error="Nessun documento aperto")
        if not Path(state.source).exists():
            return SaveResult(ok=False, error=f"File sorgente non trovato: {state.source}")

        # Pre-processing: redazione reale (rimozione testo/immagini sotto i rect)
        # Vale per EraseAnnotation(hard=True) e per TextEditAnnotation.cover_rect.
        # Produce un PDF intermedio "pulito" che diventa la sorgente per overlay+merge.
        redaction_targets = _collect_redaction_targets(state.annotations)
        if redaction_targets:
            redacted_pdf_bytes = _apply_real_redaction(Path(state.source), redaction_targets)
            reader = PdfReader(BytesIO(redacted_pdf_bytes))
        else:
            reader = PdfReader(str(state.source))

        # DEVIAZIONE dal desktop (documentata): PdfWriter(clone_from=...)
        # invece di PdfWriter()+add_page. Il writer vuoto perde il dizionario
        # /AcroForm, quindi update_page_form_field_values falliva in silenzio
        # (except: pass) e i valori form_field non venivano mai scritti.
        writer = PdfWriter(clone_from=reader)

        form_values = {
            a.field_name: a.value
            for a in state.annotations
            if isinstance(a, FormFieldAnnotation) and a.field_name
        }

        by_page: dict = {}
        for ann in state.annotations:
            by_page.setdefault(ann.page, []).append(ann)

        for i, page in enumerate(writer.pages):
            anns = by_page.get(i, [])
            if anns:
                overlay_pdf = _build_overlay(page, anns)
                overlay_reader = PdfReader(BytesIO(overlay_pdf))
                if overlay_reader.pages:
                    page.merge_page(overlay_reader.pages[0])
        if form_values:
            try:
                # I campi bottone (/Btn: checkbox e radio) vogliono il valore
                # come PDF name ("/Yes", "/Off"), non come stringa di testo.
                fields_meta = reader.get_fields() or {}
                normalized = {
                    name: (
                        f"/{value}"
                        if value
                        and not value.startswith("/")
                        and name in fields_meta
                        and str(fields_meta[name].field_type) == "/Btn"
                        else value
                    )
                    for name, value in form_values.items()
                }
                writer.update_page_form_field_values(None, normalized)
            except Exception:
                pass

        # I merge di pypdf lasciano i content stream NON compressi: senza
        # questo passaggio il PDF salvato può pesare 10x il necessario.
        for page in writer.pages:
            page.compress_content_streams()

        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "wb") as fh:
            writer.write(fh)
        state.mark_saved()
        return SaveResult(ok=True, output_path=output)
    except Exception as e:
        return SaveResult(ok=False, error=str(e))


def _collect_redaction_targets(annotations) -> dict:
    """Raccoglie i rettangoli da redarre per pagina.

    Returns: {page_idx: [(x0, y0, x1, y1, fill_rgb_or_None), ...]}
    fill_rgb_or_None: None per text_edit (fill bianco di default poi sovrascritto da overlay).
    """
    targets: dict = {}
    for ann in annotations:
        if isinstance(ann, EraseAnnotation) and ann.hard:
            targets.setdefault(ann.page, []).append((ann.rect, ann.color))
        elif isinstance(ann, TextEditAnnotation):
            targets.setdefault(ann.page, []).append((ann.cover_rect, (1.0, 1.0, 1.0)))
    return targets


def _apply_real_redaction(source: Path, targets: dict) -> bytes:
    """Apre il PDF con pymupdf, applica redazione reale sui rect specificati, ritorna i bytes.

    Coordinate input: PDF native (origin bottom-left, y crescente verso l'alto).
    Coordinate fitz: origin top-left, y crescente verso il basso.
    Conversione: fitz_y = page_height - pdf_y, swap top/bottom.
    """
    import pymupdf as fitz

    doc = fitz.open(str(source))
    try:
        for page_idx, rect_list in targets.items():
            if page_idx >= len(doc):
                continue
            page = doc[page_idx]
            page_height = page.rect.height
            for rect_pdf, fill_rgb in rect_list:
                x0, y0, x1, y1 = rect_pdf
                # Normalizza ordine
                lx0, lx1 = min(x0, x1), max(x0, x1)
                ly0, ly1 = min(y0, y1), max(y0, y1)
                # Converti in coordinate fitz (top-left origin)
                fitz_top = page_height - ly1
                fitz_bottom = page_height - ly0
                fitz_rect = fitz.Rect(lx0, fitz_top, lx1, fitz_bottom)
                page.add_redact_annot(fitz_rect, fill=fill_rgb)
            # images=2: blank out parti di immagini sovrapposte (preserva immagini fuori dal rect)
            # graphics=1: rimuove vector graphics sovrapposti
            # text=0: rimuove tutto il testo che interseca (default)
            page.apply_redactions(images=2, graphics=1, text=0)
        buf = BytesIO()
        doc.save(buf, garbage=4, deflate=True)
        return buf.getvalue()
    finally:
        doc.close()


def _build_overlay(page, anns) -> bytes:
    box = page.mediabox
    width = float(box.width)
    height = float(box.height)

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(width, height))
    for ann in anns:
        if isinstance(ann, HighlightAnnotation):
            r, g, b = ann.color
            c.setFillColor(Color(r, g, b, alpha=0.35))
            c.setStrokeColor(Color(r, g, b, alpha=0.0))
            x0, y0, x1, y1 = ann.rect
            c.rect(x0, y0, x1 - x0, y1 - y0, stroke=0, fill=1)
        elif isinstance(ann, DrawAnnotation):
            r, g, b = ann.color
            c.setStrokeColor(Color(r, g, b))
            c.setLineWidth(ann.width)
            if len(ann.points) >= 2:
                p = c.beginPath()
                p.moveTo(*ann.points[0])
                for pt in ann.points[1:]:
                    p.lineTo(*pt)
                c.drawPath(p, stroke=1, fill=0)
        elif isinstance(ann, TextAnnotation):
            r, g, b = ann.color
            c.setFillColor(Color(r, g, b))
            c.setFont("Helvetica", ann.font_size)
            c.drawString(ann.x, ann.y, ann.text)
        elif isinstance(ann, EraseAnnotation):
            # Soft erase: rettangolo opaco di overlay (no redazione reale).
            # Hard erase: già rimosso dal content stream in pre-processing; questo
            # overlay garantisce la copertura visiva immediata anche in viewer datati.
            r, g, b = ann.color
            c.setFillColor(Color(r, g, b, alpha=1.0))
            c.setStrokeColor(Color(r, g, b, alpha=0.0))
            x0, y0, x1, y1 = ann.rect
            c.rect(x0, y0, x1 - x0, y1 - y0, stroke=0, fill=1)
        elif isinstance(ann, TextEditAnnotation):
            c.setFillColor(Color(1.0, 1.0, 1.0, alpha=1.0))
            c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.0))
            x0, y0, x1, y1 = ann.cover_rect
            c.rect(x0, y0, x1 - x0, y1 - y0, stroke=0, fill=1)
            r, g, b = ann.color
            c.setFillColor(Color(r, g, b, alpha=1.0))
            c.setFont("Helvetica", ann.font_size)
            c.drawString(ann.x, ann.y, ann.text)
        elif isinstance(ann, SignatureAnnotation):
            if ann.image_path and Path(ann.image_path).exists():
                c.drawImage(
                    ann.image_path,
                    ann.x, ann.y,
                    width=ann.width, height=ann.height,
                    mask="auto",
                    preserveAspectRatio=True,
                )
    c.save()
    return buf.getvalue()
