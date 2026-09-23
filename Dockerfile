# ==========================================
# Stage 1: Build the React 18 Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build static distribution
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production Python FastAPI Runner
# ==========================================
FROM python:3.11-slim AS production-runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ENVIRONMENT=production

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user for container security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application and built frontend assets
COPY backend/app ./app
COPY --from=frontend-builder /app/dist ./dist

# Assign ownership to unprivileged user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Start FastAPI ASGI server with proxy headers support and dynamic port binding
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
