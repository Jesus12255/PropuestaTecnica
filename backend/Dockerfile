# ================================
# Stage 1: Python Builder
# ================================
FROM python:3.12-slim as python-builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies + Gunicorn
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# ================================
# Stage 2: Runtime
# ================================
FROM python:3.12-slim

# Metadata
LABEL maintainer="RFP Analyzer Team"

# Install runtime dependencies (libpq for PostgreSql)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=python-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Ensure correct permissions
RUN chown -R appuser:appuser /app

USER appuser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Health check (Use PORT env var or default 8080)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start Application with Gunicorn + Uvicorn Workers (Production Standard)
CMD gunicorn --bind :8080 --workers 1 --threads 8 --timeout 0 --worker-class uvicorn.workers.UvicornWorker "main:app"
