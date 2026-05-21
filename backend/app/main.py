from contextlib import asynccontextmanager
import logging
import os
import re
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlmodel import Session, select

from .core.config import get_settings
from .core.db import engine, init_db
from .core.security import hash_password
from .models.user import User
from .routers import auth, parcels, ai, vworld, forest, reports
from .routers.admin import admin_router

logger = logging.getLogger("twinland.migrate")
settings = get_settings()

HASHED_ASSET_RE = re.compile(r"/assets/.*-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$")


ALTERS_POSTGRES = [
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone VARCHAR',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS company VARCHAR',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE',
    "ALTER TABLE forest_feature ADD COLUMN IF NOT EXISTS geom_type VARCHAR(16) DEFAULT 'Polygon'",
]


def _auto_migrate(db: Session) -> None:
    """기존 테이블에 신규 컬럼 보정 (Postgres 전용 간이 마이그레이션).

    SQLModel `create_all()` 은 이미 존재하는 테이블의 스키마를 변경하지 않으므로,
    모델에 추가된 컬럼을 `ADD COLUMN IF NOT EXISTS` 로 보정한다.
    SQLite 는 로컬 개발용이고 신규 DB 로 시작하므로 생략.
    """
    if not settings.database_url.startswith("postgres"):
        return
    for sql in ALTERS_POSTGRES:
        try:
            db.exec(text(sql))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning("migrate skip: %s — %s", sql[:80], str(e)[:120])


def _seed_superadmin(db: Session) -> None:
    existing = db.exec(select(User).where(User.email == settings.admin_email)).first()
    if existing:
        if existing.role != "superadmin":
            existing.role = "superadmin"
            db.add(existing); db.commit()
        return
    db.add(User(
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_password),
        role="superadmin",
        display_name="Steven Lim",
        is_active=True,
    ))
    db.commit()


def _ensure_upload_dir() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.upload_dir) / "reports").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _ensure_upload_dir()
    with Session(engine) as db:
        _auto_migrate(db)
        _seed_superadmin(db)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
)


@app.middleware("http")
async def cache_control(request: Request, call_next):
    response: Response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif HASHED_ASSET_RE.search(path):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        response.headers["Cache-Control"] = "private, max-age=0, must-revalidate"
    return response


app.include_router(auth.router)
app.include_router(parcels.router)
app.include_router(ai.router)
app.include_router(vworld.router)
app.include_router(forest.router)
app.include_router(reports.router)
app.include_router(admin_router)


@app.get("/health")
def root_health():
    return {"status": "ok"}


# ── SPA 서빙 ─────────────────────────────────────────────────
# Docker 빌드 시 frontend dist → /app/static 로 복사됨.
# 로컬 개발에선 디렉토리가 없으므로 mount 자체를 건너뛴다.
STATIC_DIR = "/app/static"

if os.path.isdir(STATIC_DIR) and os.path.isfile(os.path.join(STATIC_DIR, "index.html")):
    # Vite assets 등 정적 하위 디렉토리 일괄 마운트
    for entry in os.listdir(STATIC_DIR):
        sub = os.path.join(STATIC_DIR, entry)
        if os.path.isdir(sub):
            app.mount(f"/{entry}", StaticFiles(directory=sub), name=f"static-{entry}")

    @app.get("/")
    def _serve_root():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    @app.exception_handler(404)
    async def _spa_fallback(request: Request, exc):
        p = request.url.path
        if (request.method == "GET"
            and not p.startswith("/api/")
            and not p.startswith("/uploads/")
            and not p.startswith("/docs")
            and not p.startswith("/openapi")
            and not p.startswith("/redoc")):
            candidate = os.path.join(STATIC_DIR, p.lstrip("/"))
            if os.path.isfile(candidate):
                return FileResponse(candidate)
            return FileResponse(os.path.join(STATIC_DIR, "index.html"))
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
