import io
import zipfile

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.processing import process_pdf
from core.pages import extract_pages, merge_pdfs, rotate_pdf, split_pdf

router = APIRouter()


@router.post("/api/merge")
async def merge(files: list[UploadFile]):
    if len(files) < 2:
        raise HTTPException(status_code=422, detail="Servono almeno 2 PDF")

    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = merge_pdfs(srcs, out)
        if not result.ok:
            raise HTTPException(status_code=422, detail="PDF non valido o non elaborabile")
        return out.read_bytes()

    data = await process_pdf(files, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="unito.pdf"'},
    )


@router.post("/api/split")
async def split(file: UploadFile, mode: str = Form(...), value: str = Form(...)):
    if mode not in ("every", "ranges"):
        raise HTTPException(status_code=422, detail="mode non supportato")

    def work(tmp_path, srcs):
        out_dir = tmp_path / "parts"
        result = split_pdf(srcs[0], out_dir, mode=mode, value=value)
        if not result.ok:
            raise HTTPException(status_code=422, detail="PDF non valido o parametri non validi")
        part_files = sorted(out_dir.iterdir())
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for idx, part in enumerate(part_files, 1):
                zf.writestr(f"parte_{idx:02d}.pdf", part.read_bytes())
        return buf.getvalue()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="diviso.zip"'},
    )


@router.post("/api/rotate")
async def rotate(file: UploadFile, angle: int = Form(...), pages: str = Form("")):
    if angle not in (90, 180, 270):
        raise HTTPException(status_code=422, detail="Angolo non valido")
    if pages.strip():
        try:
            page_numbers = [int(p.strip()) for p in pages.split(",") if p.strip()]
        except ValueError:
            raise HTTPException(status_code=422, detail="Elenco pagine non valido")
        rotations = {p: angle for p in page_numbers}
    else:
        rotations = {"all": angle}

    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = rotate_pdf(srcs[0], out, rotations)
        if not result.ok:
            raise HTTPException(status_code=422, detail="PDF non valido o non elaborabile")
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="ruotato.pdf"'},
    )


@router.post("/api/extract")
async def extract(file: UploadFile, pages: str = Form(...)):
    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = extract_pages(srcs[0], out, pages)
        if not result.ok:
            raise HTTPException(status_code=422, detail="Specifica pagine non valida")
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="estratto.pdf"'},
    )
