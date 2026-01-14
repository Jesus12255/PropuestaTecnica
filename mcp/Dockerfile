# MCP Talent Search - Production Dockerfile
# Multi-stage build for optimized image size

# ============================================
# Stage 1: Builder
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies into user directory
RUN pip install --user --no-cache-dir --upgrade pip

# Install PyTorch CPU-only version to reduce image size (~2GB savings)
RUN pip install --user --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Runner
# ============================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 appuser

# Install only runtime libraries needed by numpy/scipy/torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Update PATH to include user bin
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code
COPY server.py .
COPY requirements.txt .

# Create directories for data and set permissions
RUN mkdir -p /app/lancedb_data /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables (can be overridden)
ENV MCP_MODE=http
ENV MCP_PORT=8083
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8083/health || exit 1

# Default command
CMD ["python", "server.py"]
