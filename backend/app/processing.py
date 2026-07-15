import tempfile
from pathlib import Path

from anyio import fail_after, to_thread
from fastapi import HTTPException, UploadFile

from app import config

PDF_MAGIC = b"%PDF-"


async def read_pdf_upload(upload: UploadFile) -> bytes:
    """Read an uploaded file and enforce the PDF magic-byte check (415 otherwise)."""
    data = await upload.read()
    if not data.startswith(PDF_MAGIC):
        raise HTTPException(status_code=415, detail="Il file non è un PDF")
    return data


async def run_processing(work):
    """Run CPU-bound PDF work off the event loop with a hard timeout.

    `work` is a zero-arg callable executed in a worker thread. Exceeding
    config.PROCESS_TIMEOUT_S yields 504; the loop stays responsive meanwhile.
    Bytes are read inside `work`, before the caller's tempdir is torn down.
    """
    try:
        with fail_after(config.PROCESS_TIMEOUT_S):
            # abandon_on_cancel lets the timeout return promptly even though the
            # underlying blocking work cannot be interrupted mid-flight.
            return await to_thread.run_sync(work, abandon_on_cancel=True)
    except TimeoutError:
        raise HTTPException(
            status_code=504, detail="Elaborazione troppo lunga, riprova"
        )


async def process_pdf(uploads, work):
    """Full shared flow: validate uploads, stage them in a private tempdir under
    server-controlled names (never client filenames), run `work(tmp_path, srcs)`
    off-loop with timeout, and return its result bytes read before cleanup.

    `uploads` is one UploadFile or a list of them. `work` receives (tmp_path,
    list_of_source_paths) and must return the final bytes.
    """
    upload_list = list(uploads) if isinstance(uploads, (list, tuple)) else [uploads]

    datas = [await read_pdf_upload(u) for u in upload_list]

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        tmp_path = Path(tmp)
        srcs = []
        for i, data in enumerate(datas, 1):
            p = tmp_path / f"{i:03d}.pdf"
            p.write_bytes(data)
            srcs.append(p)

        def _run():
            return work(tmp_path, srcs)

        return await run_processing(_run)
