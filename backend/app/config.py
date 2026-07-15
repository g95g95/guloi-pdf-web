import os
from pathlib import Path

MAX_UPLOAD_MB = 50
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# Anti-abuse hardening (Task 6)
RATE_LIMIT_MAX = 20
RATE_LIMIT_WINDOW_S = 60
PROCESS_TIMEOUT_S = 120

# Static frontend (Task 13). Default points at the sibling frontend build
# output when running from a source checkout; in the production Docker image
# GULOI_STATIC_DIR=/app/static overrides this. Absence is tolerated (dev/test).
_DEFAULT_STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
STATIC_DIR = Path(os.environ.get("GULOI_STATIC_DIR", str(_DEFAULT_STATIC_DIR)))
