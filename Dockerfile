# syntax=docker/dockerfile:1

# --- Stage 1: build the static frontend ---
FROM node:24-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: runtime image with the FastAPI backend ---
FROM python:3.12-slim AS backend
WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/core ./core

# Built frontend assets, served by FastAPI as the SPA shell.
COPY --from=frontend-build /app/frontend/dist ./static
ENV GULOI_STATIC_DIR=/app/static

# Non-root user: the app never needs elevated privileges.
RUN useradd --create-home --shell /usr/sbin/nologin guloi \
    && chown -R guloi:guloi /app
USER guloi

EXPOSE 8000

# --no-access-log is MANDATORY, not an optimization: the privacy page
# (README "Privacy" / frontend privacy copy) promises that service logs
# contain only method, path and status for unhandled errors, and never
# client IPs or full request lines. uvicorn's built-in access log records
# the client address plus the raw request line for every request, which
# would make that promise false. The app's own exception handler
# (app/main.py) already logs "<method> <path> -> 500" and nothing else,
# so access logging is redundant with the sole log statement we want.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
