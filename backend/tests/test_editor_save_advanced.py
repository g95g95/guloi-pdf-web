from pathlib import Path
from pypdf import PdfReader
from reportlab.pdfgen import canvas as rl_canvas
from editor.annotations import EraseAnnotation, TextEditAnnotation, FormFieldAnnotation
from editor.document_state import DocumentState
from editor.save import save_document


def test_save_with_erase_annotation(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1, text="Segreto")
    out = tmp_path / "out.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        EraseAnnotation(page=0, rect=(50, 700, 300, 740), color=(1, 1, 1))
    )
    result = save_document(state, out)
    assert result.ok
    assert len(PdfReader(str(out)).pages) == 1


def test_save_with_text_edit(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1, text="Vecchio")
    out = tmp_path / "out.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        TextEditAnnotation(
            page=0,
            cover_rect=(50, 700, 300, 740),
            x=52, y=710,
            text="Nuovo testo",
            font_size=14,
        )
    )
    result = save_document(state, out)
    assert result.ok


def test_save_with_hard_erase(tmp_path, tiny_pdf):
    src = tiny_pdf("src.pdf", pages=1, text="MoltoSegreto")
    out = tmp_path / "out.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        EraseAnnotation(page=0, rect=(0, 0, 500, 800), color=(0, 0, 0), hard=True)
    )
    result = save_document(state, out)
    assert result.ok
    assert len(PdfReader(str(out)).pages) == 1


def _make_supplier_pdf(path: Path):
    """PDF di test che simula un preventivo con nome fornitore + altro testo."""
    c = rl_canvas.Canvas(str(path))
    c.drawString(100, 750, "FORNITORE_SEGRETO_XYZ")
    c.drawString(100, 700, "Prezzo unitario: 100 EUR")
    c.drawString(100, 650, "Cliente Finale Srl")
    c.showPage()
    c.save()
    return path


def test_hard_erase_removes_text_from_content_stream(tmp_path):
    """Regression: dopo hard erase, il testo redatto non deve essere estraibile."""
    src = _make_supplier_pdf(tmp_path / "preventivo.pdf")
    out = tmp_path / "preventivo_redatto.pdf"
    state = DocumentState(source=src)
    # Rect copre la riga del fornitore (y=750 in coord PDF, h~14pt → rect 740..760)
    state.annotations.append(
        EraseAnnotation(
            page=0, rect=(95, 740, 350, 765), color=(1, 1, 1), hard=True,
        )
    )
    result = save_document(state, out)
    assert result.ok

    extracted = PdfReader(str(out)).pages[0].extract_text() or ""
    assert "FORNITORE_SEGRETO_XYZ" not in extracted, (
        f"Testo sensibile ancora estraibile dopo redazione hard: {extracted!r}"
    )


def test_hard_erase_preserves_text_outside_rect(tmp_path):
    """Regression: hard erase deve rimuovere SOLO ciò che intercetta, non altro."""
    src = _make_supplier_pdf(tmp_path / "preventivo.pdf")
    out = tmp_path / "preventivo_redatto.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        EraseAnnotation(
            page=0, rect=(95, 740, 350, 765), color=(1, 1, 1), hard=True,
        )
    )
    result = save_document(state, out)
    assert result.ok

    extracted = PdfReader(str(out)).pages[0].extract_text() or ""
    # Testo fuori dal rect deve sopravvivere
    assert "Prezzo unitario" in extracted, (
        f"Testo non-target perso erroneamente: {extracted!r}"
    )
    assert "Cliente Finale" in extracted


def test_text_edit_removes_original_text(tmp_path):
    """Regression: TextEditAnnotation rimuove testo originale dal content stream."""
    src = _make_supplier_pdf(tmp_path / "preventivo.pdf")
    out = tmp_path / "preventivo_modificato.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        TextEditAnnotation(
            page=0,
            cover_rect=(95, 740, 350, 765),
            x=100, y=750,
            text="FORNITORE_PUBBLICO",
            font_size=12,
        )
    )
    result = save_document(state, out)
    assert result.ok

    extracted = PdfReader(str(out)).pages[0].extract_text() or ""
    assert "FORNITORE_SEGRETO_XYZ" not in extracted, (
        f"Testo originale ancora presente dopo text_edit: {extracted!r}"
    )


def test_soft_erase_does_not_remove_text(tmp_path):
    """Soft erase (hard=False): testo originale RESTA nel content stream (solo coperto)."""
    src = _make_supplier_pdf(tmp_path / "preventivo.pdf")
    out = tmp_path / "preventivo_soft.pdf"
    state = DocumentState(source=src)
    state.annotations.append(
        EraseAnnotation(
            page=0, rect=(95, 740, 350, 765), color=(1, 1, 1), hard=False,
        )
    )
    result = save_document(state, out)
    assert result.ok

    extracted = PdfReader(str(out)).pages[0].extract_text() or ""
    # Soft = solo overlay visivo, testo ancora estraibile
    assert "FORNITORE_SEGRETO_XYZ" in extracted
