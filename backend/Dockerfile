# ===== TwinLand fullstack — Orbitron-compatible multi-stage =====
# 빌드 컨텍스트 = deployment root (Orbitron 가 `docker build <deployment_dir>` 로 실행)
# COPY 경로 prefix: backend/ , frontend/  ← root 기준

# Stage 1: Build frontend (Vite)
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Backend + serve SPA
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# 시스템 의존성 (GIS 런타임)
# rasterio / pyogrio / shapely → libgdal-dev libgeos-dev libproj-dev libexpat1
# psycopg2-binary → libpq-dev
# pip install build → build-essential
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    libexpat1 libgdal-dev libgeos-dev libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 백엔드 코드
COPY backend/app ./app
COPY backend/scripts ./scripts

# 프론트 빌드 산출물 → /app/static (main.py 가 StaticFiles 로 마운트)
COPY --from=frontend-build /build/dist /app/static

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
