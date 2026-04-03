# ═══════════════════════════════════════════════════════════════════
#  Backend Dockerfile — Multi-stage Production Build
#
#  Stage 1 (builder): installs all Python dependencies
#  Stage 2 (production): copies only what is needed to run
#
#  Result: small, secure image with no build tools included
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Builder ─────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install dependencies into /install prefix
# This makes it easy to copy just the packages to the next stage
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Production ──────────────────────────────────────────────
FROM python:3.11-slim AS production

# Security: create and use a non-root user
# If container is compromised, attacker has limited permissions
RUN groupadd -r appuser && \
    useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application code with correct ownership
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 5000

# Health check — Docker/Kubernetes uses this to monitor container health
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" || exit 1

# Use gunicorn in production — NOT flask dev server
# 4 workers x 2 threads = 8 concurrent requests
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
