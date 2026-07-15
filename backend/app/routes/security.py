from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.processing import process_pdf
from core.security import remove_password, set_password

router = APIRouter()


@router.post("/api/password/set")
async def password_set(file: UploadFile, password: str = Form(...), owner_password: str = Form("")):
    if not password:
        raise HTTPException(status_code=422, detail="Password obbligatoria")

    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = set_password(srcs[0], out, password, owner_password or None)
        if not result.ok:
            raise HTTPException(status_code=422, detail="PDF non valido o non elaborabile")
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="protetto.pdf"'},
    )


@router.post("/api/password/remove")
async def password_remove(file: UploadFile, password: str = Form(...)):
    def work(tmp_path, srcs):
        out = tmp_path / "out.pdf"
        result = remove_password(srcs[0], out, password)
        if not result.ok:
            raise HTTPException(status_code=422, detail="Password errata")
        return out.read_bytes()

    data = await process_pdf(file, work)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="sbloccato.pdf"'},
    )
