from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.processing import process_pdf
from core.compress import compress_pdf

router = APIRouter()


@router.post("/api/compress")
async def compress(file: UploadFile, compress_images: bool = Form(False)):
    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = compress_pdf(srcs[0], out, compress_images=compress_images)
        if not result.ok:
            raise HTTPException(status_code=422, detail="PDF non valido o non elaborabile")
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="compresso.pdf"'},
    )
