"""API tests for /api/editor/save and /api/editor/fields."""

import io
import json

from pypdf import PdfReader
from reportlab.pdfgen import canvas as rl_canvas


def _pdf_bytes(text="Contenuto di prova", extra_lines=()):
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    c.drawString(100, 750, text)
    for i, line in enumerate(extra_lines):
        c.drawString(100, 700 - 50 * i, line)
    c.showPage()
    c.save()
    return buf.getvalue()


def _form_pdf_bytes():
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    c.drawString(100, 750, "Nome:")
    c.acroForm.textfield(name="nome", x=150, y=740, width=200, height=20)
    c.save()
    return buf.getvalue()


# 2x2 red PNG (generated with Pillow).
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd4"
    "9a730000001649444154789c63fccfc0c0c0c0c0c4c0c0c0c0c000000d1d01"
    "036ac29be90000000049454e44ae426082"
)


def _post_save(client, pdf, annotations, signatures=None):
    files = [("file", ("doc.pdf", pdf, "application/pdf"))]
    for key, data in (signatures or {}).items():
        files.append(("signatures", (key, data, "image/png")))
    return client.post(
        "/api/editor/save",
        files=files,
        data={"annotations": json.dumps(annotations)},
    )


# --- /api/editor/save --------------------------------------------------------


def test_save_happy_path_text_annotation(client):
    r = _post_save(client, _pdf_bytes(), [
        {"kind": "text", "page": 0, "x": 100, "y": 400,
         "text": "TESTO_AGGIUNTO_ABC", "font_size": 14, "color": [0, 0, 0]},
    ])
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert r.headers["content-disposition"] == 'attachment; filename="modificato.pdf"'
    reader = PdfReader(io.BytesIO(r.content))
    assert len(reader.pages) == 1
    assert "TESTO_AGGIUNTO_ABC" in (reader.pages[0].extract_text() or "")


def test_save_empty_annotations_list(client):
    r = _post_save(client, _pdf_bytes(), [])
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_save_hard_erase_removes_marker_from_text(client):
    """Endpoint-level redaction proof: hard erase strips the marker from the
    content stream, not just visually."""
    pdf = _pdf_bytes("FORNITORE_SEGRETO_XYZ", extra_lines=["Prezzo unitario: 100 EUR"])
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 0, "rect": [95, 740, 350, 765],
         "color": [1, 1, 1], "hard": True},
    ])
    assert r.status_code == 200
    extracted = PdfReader(io.BytesIO(r.content)).pages[0].extract_text() or ""
    assert "FORNITORE_SEGRETO_XYZ" not in extracted
    assert "Prezzo unitario" in extracted


def test_save_soft_erase_keeps_text(client):
    pdf = _pdf_bytes("FORNITORE_SEGRETO_XYZ")
    r = _post_save(client, pdf, [
        {"kind": "erase", "page": 0, "rect": [95, 740, 350, 765],
         "color": [1, 1, 1], "hard": False},
    ])
    assert r.status_code == 200
    extracted = PdfReader(io.BytesIO(r.content)).pages[0].extract_text() or ""
    assert "FORNITORE_SEGRETO_XYZ" in extracted


def test_save_text_edit_replaces_content(client):
    pdf = _pdf_bytes("FORNITORE_SEGRETO_XYZ")
    r = _post_save(client, pdf, [
        {"kind": "text_edit", "page": 0, "cover_rect": [95, 740, 350, 765],
         "x": 100, "y": 750, "text": "FORNITORE_PUBBLICO", "font_size": 12},
    ])
    assert r.status_code == 200
    extracted = PdfReader(io.BytesIO(r.content)).pages[0].extract_text() or ""
    assert "FORNITORE_SEGRETO_XYZ" not in extracted
    assert "FORNITORE_PUBBLICO" in extracted


def test_save_signature_flow(client):
    r = _post_save(
        client,
        _pdf_bytes(),
        [{"kind": "signature", "page": 0, "x": 100, "y": 100,
          "width": 50, "height": 50, "image_key": "sig-1"}],
        signatures={"sig-1": TINY_PNG},
    )
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert len(PdfReader(io.BytesIO(r.content)).pages) == 1


def test_save_form_field_annotation(client):
    r = _post_save(client, _form_pdf_bytes(), [
        {"kind": "form_field", "page": 0, "field_name": "nome", "value": "Mario"},
    ])
    assert r.status_code == 200
    fields = PdfReader(io.BytesIO(r.content)).get_form_text_fields() or {}
    assert fields.get("nome") == "Mario"


def _rich_form_pdf_bytes():
    """PDF con checkbox, radio (2 opzioni) e menu a tendina."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    c.acroForm.checkbox(name="privacy", x=100, y=700, size=16)
    c.acroForm.radio(name="colore", value="rosso", x=100, y=650, size=16)
    c.acroForm.radio(name="colore", value="blu", x=140, y=650, size=16)
    c.acroForm.choice(
        name="taglia", options=["S", "M", "L"], value="S",
        x=100, y=600, width=120, height=22,
    )
    c.showPage()  # senza, reportlab non risolve i riferimenti dei widget
    c.save()
    return buf.getvalue()


def test_save_checkbox_radio_choice_values(client):
    r = _post_save(client, _rich_form_pdf_bytes(), [
        {"kind": "form_field", "page": 0, "field_name": "privacy", "value": "Yes"},
        {"kind": "form_field", "page": 0, "field_name": "colore", "value": "blu"},
        {"kind": "form_field", "page": 0, "field_name": "taglia", "value": "L"},
    ])
    assert r.status_code == 200
    fields = PdfReader(io.BytesIO(r.content)).get_fields()
    assert str(fields["privacy"].value).lstrip("/") == "Yes"
    assert str(fields["colore"].value).lstrip("/") == "blu"
    assert str(fields["taglia"].value).lstrip("/") == "L"


def test_save_checkbox_unchecked_value_off(client):
    r = _post_save(client, _rich_form_pdf_bytes(), [
        {"kind": "form_field", "page": 0, "field_name": "privacy", "value": "Off"},
    ])
    assert r.status_code == 200
    fields = PdfReader(io.BytesIO(r.content)).get_fields()
    assert str(fields["privacy"].value or "Off").lstrip("/") == "Off"


def test_save_invalid_annotations_json_422(client):
    r = client.post(
        "/api/editor/save",
        files={"file": ("doc.pdf", _pdf_bytes(), "application/pdf")},
        data={"annotations": "{not json"},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "Annotazioni non valide"


def test_save_unknown_kind_422(client):
    r = _post_save(client, _pdf_bytes(), [{"kind": "sneaky", "page": 0}])
    assert r.status_code == 422
    assert r.json()["detail"] == "Annotazioni non valide"


def test_save_missing_signature_upload_422(client):
    r = _post_save(client, _pdf_bytes(), [
        {"kind": "signature", "page": 0, "x": 0, "y": 0,
         "width": 10, "height": 10, "image_key": "assente"},
    ])
    assert r.status_code == 422
    assert r.json()["detail"] == "Annotazioni non valide"


def test_save_signature_bad_magic_422(client):
    r = _post_save(
        client,
        _pdf_bytes(),
        [{"kind": "signature", "page": 0, "x": 0, "y": 0,
          "width": 10, "height": 10, "image_key": "sig-1"}],
        signatures={"sig-1": b"GIF89a not allowed"},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "Immagine firma non valida"


def test_save_signature_bad_key_name_422(client):
    r = _post_save(
        client,
        _pdf_bytes(),
        [],
        signatures={"../evil": TINY_PNG},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "Immagine firma non valida"


def test_save_too_many_signatures_422(client):
    sigs = {f"sig-{i}": TINY_PNG for i in range(11)}
    r = _post_save(client, _pdf_bytes(), [], signatures=sigs)
    assert r.status_code == 422
    assert r.json()["detail"] == "Immagine firma non valida"


def test_save_non_pdf_415(client):
    r = client.post(
        "/api/editor/save",
        files={"file": ("doc.pdf", b"not a pdf", "application/pdf")},
        data={"annotations": "[]"},
    )
    assert r.status_code == 415


def test_save_corrupt_pdf_422(client):
    corrupt = b"%PDF-1.4\n" + b"garbage " * 50
    r = client.post(
        "/api/editor/save",
        files={"file": ("doc.pdf", corrupt, "application/pdf")},
        data={"annotations": "[]"},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "PDF non valido o non elaborabile"


# --- /api/editor/fields ------------------------------------------------------


def test_fields_endpoint_acroform(client):
    r = client.post(
        "/api/editor/fields",
        files={"file": ("doc.pdf", _form_pdf_bytes(), "application/pdf")},
    )
    assert r.status_code == 200
    fields = r.json()
    assert isinstance(fields, list)
    assert {"name": "nome", "value": "", "kind": "text"} in fields


def test_fields_endpoint_plain_pdf_empty_list(client):
    r = client.post(
        "/api/editor/fields",
        files={"file": ("doc.pdf", _pdf_bytes(), "application/pdf")},
    )
    assert r.status_code == 200
    assert r.json() == []


def test_fields_endpoint_non_pdf_415(client):
    r = client.post(
        "/api/editor/fields",
        files={"file": ("doc.txt", b"nope", "application/pdf")},
    )
    assert r.status_code == 415
