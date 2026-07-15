import logging

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.middleware import MaxBodySizeMiddleware, RateLimitMiddleware
from app.routes.compress import router as compress_router
from app.routes.editor import router as editor_router
from app.routes.pages import router as pages_router
from app.routes.security import router as security_router

logger = logging.getLogger("guloi.api")

# Long-cache for hashed build assets (filenames contain a content hash, so a
# far-future cache is safe); index.html is intentionally NOT cached this way.
_ASSETS_CACHE_CONTROL = "public, max-age=31536000, immutable"


class _CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = _ASSETS_CACHE_CONTROL
        return response


def create_app() -> FastAPI:
    app = FastAPI(title="Guloi PDF")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    app.include_router(compress_router)
    app.include_router(pages_router)
    app.include_router(security_router)
    app.include_router(editor_router)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Log only method+path+status; never filenames, form values, or content.
        logger.error("%s %s -> 500", request.method, request.url.path)
        return JSONResponse({"detail": "Errore interno"}, status_code=500)

    # Order: outermost = size guard, then rate limit, then routes.
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(MaxBodySizeMiddleware)

    static_dir = config.STATIC_DIR
    index_path = static_dir / "index.html"
    assets_dir = static_dir / "assets"
    if static_dir.is_dir() and index_path.is_file():
        if assets_dir.is_dir():
            app.mount("/assets", _CachedStaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/", include_in_schema=False)
        async def serve_index():
            return FileResponse(index_path)

        @app.exception_handler(404)
        async def spa_fallback(request: Request, exc):
            # /api/* 404s must stay JSON. Root-level build artifacts (e.g.
            # favicon.svg) are served directly if present; everything else
            # falls back to the SPA shell so client-side routing (deep
            # links) can take over.
            if request.url.path.startswith("/api/"):
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            candidate = (static_dir / request.url.path.lstrip("/")).resolve()
            if (
                candidate.is_file()
                and static_dir.resolve() in candidate.parents
            ):
                return FileResponse(candidate)
            return FileResponse(index_path)

    return app


app = create_app()
