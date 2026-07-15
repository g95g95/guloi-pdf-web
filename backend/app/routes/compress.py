import io
import zipfile
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.processing import process_pdf
from core.compress import compress_pdf, compress_to_target

router = APIRouter()


def _compress_one(src, out, compress_images, target_mb):
    if target_mb is not None:
        if target_mb <= 0:
            raise HTTPException(status_code=422, detail="Dimensione target non valida")
        result = compress_to_target(src, out, int(target_mb * 1024 * 1024))
    else:
        result = compress_pdf(src, out, compress_images=compress_images)
    if not result.ok:
        raise HTTPException(status_code=422, detail="PDF non valido o non elaborabile")
    return result


@router.post("/api/compress")
async def compress(
    files: list[UploadFile],
    compress_images: bool = Form(False),
    target_mb: Optional[float] = Form(None),
):
    if not files:
        raise HTTPException(status_code=422, detail="Nessun file caricato")

    single = len(files) == 1

    def work(tmp_path, srcs):
        if single:
            out = tmp_path / "out.pdf"
            result = _compress_one(srcs[0], out, compress_images, target_mb)
            return out.read_bytes(), result.target_met

        buf = io.BytesIO()
        all_met = True
        with zipfile.ZipFile(buf, "w") as zf:
            for idx, src in enumerate(srcs, 1):
                out = tmp_path / f"out_{idx:02d}.pdf"
                result = _compress_one(src, out, compress_images, target_mb)
                name = f"compresso_{idx:02d}.pdf"
                if result.target_met is False:
                    all_met = False
                    name = f"compresso_{idx:02d}_TARGET_NON_RAGGIUNTO.pdf"
                zf.writestr(name, out.read_bytes())
        return buf.getvalue(), (all_met if target_mb is not None else None)

    data, target_met = await process_pdf(files, work)
    if single:
        headers = {"Content-Disposition": 'attachment; filename="compresso.pdf"'}
        if target_met is not None:
            headers["X-Target-Met"] = "true" if target_met else "false"
        return Response(data, media_type="application/pdf", headers=headers)

    headers = {"Content-Disposition": 'attachment; filename="compressi.zip"'}
    if target_met is not None:
        headers["X-Target-Met"] = "true" if target_met else "false"
    return Response(data, media_type="application/zip", headers=headers)
