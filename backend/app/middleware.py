import time
from collections import deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app import config

# Safety cap on distinct tracked client keys (memory bound).
MAX_TRACKED_KEYS = 10_000


class SlidingWindowRateLimiter:
    """In-memory per-IP sliding window. Test-controllable via reset()/set_clock()."""

    def __init__(self):
        self._hits: dict[str, deque[float]] = {}
        self._clock = time.monotonic
        self._last_sweep = None

    def set_clock(self, clock):
        """Inject a callable returning a float 'now'; pass None to restore default."""
        self._clock = clock or time.monotonic

    def reset(self):
        self._hits.clear()
        self._last_sweep = None

    def allow(self, key: str) -> bool:
        now = self._clock()
        window = config.RATE_LIMIT_WINDOW_S
        limit = config.RATE_LIMIT_MAX
        self._sweep(now, window)
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - window:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        # Hard memory bound: drop the least-recently-active keys if over cap.
        while len(self._hits) > MAX_TRACKED_KEYS:
            oldest = min(self._hits, key=lambda k: self._hits[k][-1])
            del self._hits[oldest]
        return True

    def _sweep(self, now, window):
        """At most once per window, evict stale hits and delete idle keys."""
        if self._last_sweep is None:
            self._last_sweep = now
            return
        if now - self._last_sweep < window:
            return
        self._last_sweep = now
        for k in list(self._hits):
            hits = self._hits[k]
            while hits and hits[0] <= now - window:
                hits.popleft()
            if not hits:
                del self._hits[k]


rate_limiter = SlidingWindowRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path != "/api/health":
            # Behind Render's proxy request.client.host is the proxy itself; the
            # real client is the first hop of X-Forwarded-For. We trust XFF here
            # because Render's proxy overwrites it on every incoming request.
            xff = request.headers.get("x-forwarded-for")
            if xff and xff.split(",")[0].strip():
                client = xff.split(",")[0].strip()
            else:
                client = request.client.host if request.client else "unknown"
            if not rate_limiter.allow(client):
                return JSONResponse(
                    {"detail": "Troppe richieste, riprova tra poco"},
                    status_code=429,
                )
        return await call_next(request)


class MaxBodySizeMiddleware:
    """Pure-ASGI guard: rejects oversized uploads via Content-Length header AND by
    counting the actual streamed body bytes (an absent/lying header cannot bypass)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return

        limit = config.MAX_UPLOAD_BYTES

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > limit:
                        await self._reject(scope, receive, send)
                        return
                except ValueError:
                    pass
                break

        # Buffer the body (bounded by `limit`) so an oversized upload is rejected
        # with 413 before the request ever reaches a route.
        body_parts = []
        received = 0
        more = True
        while more:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            received += len(chunk)
            if received > limit:
                await self._reject(scope, receive, send)
                return
            body_parts.append(chunk)
            more = message.get("more_body", False)

        body = b"".join(body_parts)
        replayed = False

        async def replay_receive():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)

    async def _reject(self, scope, receive, send):
        response = JSONResponse({"detail": "File troppo grande"}, status_code=413)
        await response(scope, receive, send)
