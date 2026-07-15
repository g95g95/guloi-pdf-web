"""Endpoint-level real-redaction regression suite (Task 16).

Transposes the desktop redaction regression semantics onto POST /api/editor/save
and adds hardening cases the desktop suite cannot express (multi-page,
frontend-serializer parity, page-edge rects, decoded-stream + raw-byte proofs,
combined workflow).

Gap analysis vs tests/test_api_editor.py (already endpoint-covered):
  - hard erase removes marker (extract_text level)      -> covered; here deepened
    to decoded content streams AND raw output bytes.
  - hard erase preserves neighbor text                  -> covered.
  - text_edit removes original                          -> covered.
  - soft erase keeps text                               -> covered.
The cases below close the depth gap and add the multi-page / parity / edge /
combined hardening the desktop tests do not reach.
"""

import io
import json

from pypdf import PdfReader
from reportlab.pdfgen import canvas as rl_canvas


def _pdf_bytes(lines, page_size=None):
    """One-page PDF; `lines` is a list of (x, y, text)."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=page_size) if page_size else rl_canvas.Canvas(buf)
    for x, y, text in lines:
        c.drawString(x, y, text)
    c.showPage()
    c.save()
    return buf.getvalue()


def _multipage_pdf_bytes(marker, pages=3):
    """`pages`-page PDF with the SAME marker at the SAME spot on every page."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    for _ in range(pages):
        c.drawString(100, 750, marker)
        c.showPage()
    c.save()
    return buf.getvalue()


def _post_save(client, pdf, annotations):
    return client.post(
        "/api/editor/save",
        files=[("file", ("doc.pdf", pdf, "application/pdf"))],
        data={"annotations": json.dumps(annotations)},
    )


def _decoded_streams(reader):
    """Concatenated DECODED content streams across all pages (bytes)."""
    out = b""
    for page in reader.pages:
        contents = page.get_contents()
        if contents is not None:
            out += contents.get_data()
    return out


def _marker_absent_everywhere(content_bytes, reader, marker):
    """Belt-and-suspenders: marker gone from extract_text, decoded streams,
    AND raw output bytes (defeats a compressed-stream blind spot in extract_text)."""
    for page in reader.pages:
        assert marker not in (page.extract_text() or "")
    assert marker.encode() not in _decoded_streams(reader)
    assert marker.encode() not in content_bytes


# --- deepened core proof (closes the depth gap) ------------------------------


def test_hard_erase_marker_absent_from_streams_and_raw_bytes(client):
    """Main marker test one step deeper than extract_text: assert the marker is
    absent from decoded content streams AND from the raw output bytes."""
    marker = "FORNITORE_SEGRETO_XYZ"
    pdf = _pdf_bytes([(100, 750, marker), (100, 700, "Prezzo unitario: 100 EUR")])
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 0, "rect": [95, 740, 350, 765],
         "color": [1, 1, 1], "hard": True},
    ])
    assert r.status_code == 200
    reader = PdfReader(io.BytesIO(r.content))
    _marker_absent_everywhere(r.content, reader, marker)
    # Neighbor outside the rect survives.
    assert "Prezzo unitario" in (reader.pages[0].extract_text() or "")


# --- multi-page redaction ----------------------------------------------------


def test_hard_erase_multipage_only_target_page(client):
    """3-page PDF, hard erase page 1 only -> marker gone on page 1, identical
    markers on pages 0 and 2 preserved."""
    marker = "MARKER_RIPETUTO_123"
    pdf = _multipage_pdf_bytes(marker, pages=3)
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 1, "rect": [95, 740, 350, 765],
         "color": [1, 1, 1], "hard": True},
    ])
    assert r.status_code == 200
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 3
    assert marker in (reader.pages[0].extract_text() or "")
    assert marker not in (reader.pages[1].extract_text() or "")
    assert marker in (reader.pages[2].extract_text() or "")


# --- frontend-serializer parity ----------------------------------------------


def _wire_erase(page, rect, color, hard):
    """Mirror frontend annotations.ts toWire() 'erase' key order/types EXACTLY:
    { kind, page, rect, color, hard }."""
    return {"kind": "erase", "page": page, "rect": rect, "color": color, "hard": hard}


def _wire_text_edit(page, cover_rect, x, y, text, font_size, color):
    """Mirror toWire() 'text_edit': { kind, page, cover_rect, x, y, text,
    font_size, color }."""
    return {
        "kind": "text_edit", "page": page, "cover_rect": cover_rect,
        "x": x, "y": y, "text": text, "font_size": font_size, "color": color,
    }


def test_frontend_serializer_parity_hard_erase_and_text_edit(client):
    """Build the annotations JSON exactly as frontend toWire() emits it (verbatim
    key order per kind) for a hard erase + text_edit combo; assert the endpoint
    accepts it and redacts. Guards the 15a/15b integration seam."""
    secret = "SEGRETO_SERIALIZER"
    original = "ORIGINALE_TEXTEDIT"
    replacement = "SOSTITUTO_PUBBLICO"
    pdf = _pdf_bytes([(100, 750, secret), (100, 600, original)])
    annotations = [
        _wire_erase(0, [95, 740, 350, 765], [1.0, 1.0, 1.0], True),
        _wire_text_edit(0, [95, 590, 350, 615], 100, 600, replacement, 12.0,
                        [0.0, 0.0, 0.0]),
    ]
    # Assert wire shape matches toWire() key order verbatim (drift = invisible bug).
    assert list(annotations[0].keys()) == ["kind", "page", "rect", "color", "hard"]
    assert list(annotations[1].keys()) == [
        "kind", "page", "cover_rect", "x", "y", "text", "font_size", "color",
    ]
    r = _post_save(client, pdf, annotations)
    assert r.status_code == 200
    reader = PdfReader(io.BytesIO(r.content))
    extracted = reader.pages[0].extract_text() or ""
    assert secret not in extracted
    assert original not in extracted
    assert replacement in extracted
    assert secret.encode() not in _decoded_streams(reader)


# --- page-edge full-page redaction -------------------------------------------


def test_hard_erase_full_page_edge_rect_removes_all_text(client):
    """Rect [0,0,width,height] full-page hard erase -> all text gone; output
    still a valid PDF with the same page count."""
    width, height = 400, 600
    pdf = _pdf_bytes(
        [(50, 550, "PRIMA_RIGA_AAA"), (50, 300, "SECONDA_RIGA_BBB"),
         (50, 50, "TERZA_RIGA_CCC")],
        page_size=(width, height),
    )
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 0, "rect": [0, 0, width, height],
         "color": [0, 0, 0], "hard": True},
    ])
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 1
    extracted = reader.pages[0].extract_text() or ""
    for marker in ("PRIMA_RIGA_AAA", "SECONDA_RIGA_BBB", "TERZA_RIGA_CCC"):
        assert marker not in extracted
        assert marker.encode() not in _decoded_streams(reader)


# --- combined workflow -------------------------------------------------------


def test_combined_workflow_mixed_annotations_same_page(client):
    """One request: hard erase + soft erase + text + highlight + text_edit on the
    same page. Hard-redacted markers gone; marker under SOFT erase still
    extractable; added text present; 200 valid PDF."""
    hard_secret = "HARD_SEGRETO_111"
    soft_secret = "SOFT_SEGRETO_222"
    orig_edit = "ORIG_EDIT_333"
    pdf = _pdf_bytes([
        (100, 750, hard_secret),
        (100, 650, soft_secret),
        (100, 550, orig_edit),
        (100, 450, "TESTO_EVIDENZIATO_444"),
    ])
    added = "TESTO_AGGIUNTO_555"
    edited = "EDIT_NUOVO_666"
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 0, "rect": [95, 740, 350, 765],
         "color": [1, 1, 1], "hard": True},
        {"kind": "erase", "page": 0, "rect": [95, 640, 350, 665],
         "color": [1, 1, 1], "hard": False},
        {"kind": "text", "page": 0, "x": 100, "y": 350,
         "text": added, "font_size": 12, "color": [0, 0, 0]},
        {"kind": "highlight", "page": 0, "rect": [95, 445, 300, 465],
         "color": [1, 1, 0]},
        {"kind": "text_edit", "page": 0, "cover_rect": [95, 540, 350, 565],
         "x": 100, "y": 550, "text": edited, "font_size": 12, "color": [0, 0, 0]},
    ])
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 1
    extracted = reader.pages[0].extract_text() or ""
    # Hard redactions gone (deep check).
    assert hard_secret not in extracted
    assert hard_secret.encode() not in _decoded_streams(reader)
    assert orig_edit not in extracted
    assert orig_edit.encode() not in _decoded_streams(reader)
    # Soft erase: marker still extractable (only visually covered).
    assert soft_secret in extracted
    # Added + edited text present.
    assert added in extracted
    assert edited in extracted
