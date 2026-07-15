import re

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

from app.processing import process_pdf
from app.schemas import (
    AnnotationValidationError,
    parse_annotations,
    to_dataclasses,
)
from core.forms import read_form_fields
from editor.document_state import DocumentState
from editor.save import save_document

router = APIRouter()

_IMAGE_KEY_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"
MAX_SIGNATURES = 10
MAX_SIGNATURE_BYTES = 5 * 1024 * 1024

# Fixed-string error details only: never echo user data.
_ERR_ANNOTATIONS = "Annotazioni non valide"
_ERR_SIGNATURE = "Immagine firma non valida"
_ERR_PDF = "PDF non valido o non elaborabile"


async def _read_signatures(signatures: list[UploadFile]) -> dict[str, bytes]:
    """Validate and read the uploaded signature images.

    The multipart *filename* of each `signatures` part is its image_key
    (identifier [a-zA-Z0-9_-]{1,64}, must be unique). Content must be PNG or
    JPEG by magic bytes, <= 5 MB each, max 10 files. Any violation -> 422
    with a fixed message (no user data echoed).
    """
    if len(signatures) > MAX_SIGNATURES:
        raise HTTPException(status_code=422, detail=_ERR_SIGNATURE)
    out: dict[str, bytes] = {}
    for upload in signatures:
        key = upload.filename or ""
        if not _IMAGE_KEY_RE.fullmatch(key) or key in out:
            raise HTTPException(status_code=422, detail=_ERR_SIGNATURE)
        data = await upload.read()
        if len(data) > MAX_SIGNATURE_BYTES:
            raise HTTPException(status_code=422, detail=_ERR_SIGNATURE)
        if not (data.startswith(_PNG_MAGIC) or data.startswith(_JPEG_MAGIC)):
            raise HTTPException(status_code=422, detail=_ERR_SIGNATURE)
        out[key] = data
    return out


@router.post("/api/editor/save")
async def editor_save(
    file: UploadFile,
    annotations: str = Form(...),
    signatures: list[UploadFile] = File(default=[]),
):
    """Apply editor annotations to a PDF and return the result.

    Multipart contract:
      - file: the source PDF.
      - annotations: JSON string, array of annotation objects discriminated
        by "kind" (see app/schemas.py for the full wire format). Coordinates
        are PDF-native points (origin bottom-left). Max 500 annotations.
      - signatures (optional, repeatable): PNG/JPEG images referenced by
        signature annotations. The part's filename is the image_key
        ([a-zA-Z0-9_-]{1,64}); see _read_signatures for the limits.

    Hard-erase rects and text_edit cover_rects are REALLY redacted (content
    stream removal via pymupdf) before the visual overlay is merged.
    Response: the final PDF as attachment "modificato.pdf".
    """
    try:
        models = parse_annotations(annotations)
    except AnnotationValidationError:
        raise HTTPException(status_code=422, detail=_ERR_ANNOTATIONS)

    sig_datas = await _read_signatures(signatures)

    def work(tmp_path, srcs):
        sig_paths = {}
        for i, (key, data) in enumerate(sig_datas.items()):
            p = tmp_path / f"sig_{i:03d}.img"
            p.write_bytes(data)
            sig_paths[key] = p
        try:
            anns = to_dataclasses(models, sig_paths)
        except AnnotationValidationError:
            raise HTTPException(status_code=422, detail=_ERR_ANNOTATIONS)
        state = DocumentState(source=srcs[0], annotations=anns)
        out = tmp_path / "out.pdf"
        result = save_document(state, out)
        if not result.ok:
            raise HTTPException(status_code=422, detail=_ERR_PDF)
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="modificato.pdf"'},
    )


@router.post("/api/editor/fields")
async def editor_fields(file: UploadFile):
    """Return the PDF's AcroForm fields as [{name, value, kind}] (empty list
    if the document has no form)."""

    def work(tmp_path, srcs):
        fields = read_form_fields(srcs[0])
        return [
            {"name": f.name, "value": f.value, "kind": f.field_type}
            for f in fields
        ]

    data = await process_pdf(file, work)
    return JSONResponse(data)
