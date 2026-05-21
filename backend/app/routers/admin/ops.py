"""어드민: 운영 모니터링 (OpenClaw ping + DB 상태 + 버전)."""
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from ...core.config import get_settings
from ...core.db import get_session
from ...core.deps import require_admin
from ...models.user import User

router = APIRouter()
settings = get_settings()


@router.get("/ops")
def ops_status(admin: User = Depends(require_admin), db: Session = Depends(get_session)):
    # OpenClaw ping (간이) — 실제 WS 연결은 무거우므로 환경 값만 노출
    openclaw_url = settings.openclaw_ws_url

    # DB 헬스
    t0 = time.time()
    user_count = db.exec(select(func.count()).select_from(User)).one()
    db_ms = int((time.time() - t0) * 1000)

    return {
        "now": datetime.now(timezone.utc).isoformat(),
        "app": {
            "name": settings.app_name,
            "env": settings.env,
        },
        "db": {
            "url_prefix": settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url,
            "user_count": int(user_count),
            "latency_ms": db_ms,
        },
        "openclaw": {
            "ws_url": openclaw_url,
            "agent_pet": settings.openclaw_agent_pet,
            "models": {
                "default": settings.openclaw_model_default,
                "agent": settings.openclaw_model_agent,
                "vision": settings.openclaw_model_vision,
            },
        },
        "email": {
            "provider_configured": bool(settings.resend_api_key),
            "from": settings.email_from,
        },
        "upload": {
            "dir": settings.upload_dir,
            "max_mb": settings.max_upload_mb,
        },
    }


@router.get("/ops/openclaw/ping")
async def openclaw_ping(admin: User = Depends(require_admin)):
    """WS 핑은 네트워크 비용이 있으므로 별도 엔드포인트로 분리."""
    import asyncio
    try:
        import websockets  # type: ignore
    except ImportError:
        return {"ok": False, "error": "websockets not installed"}

    try:
        async with websockets.connect(settings.openclaw_ws_url, open_timeout=3) as ws:
            await ws.send('{"method":"ping","id":1}')
            try:
                pong = await asyncio.wait_for(ws.recv(), timeout=3)
            except asyncio.TimeoutError:
                pong = "(timeout on recv)"
            return {"ok": True, "response": str(pong)[:300]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}
