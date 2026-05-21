from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..core.config import get_settings
from ..core.db import get_session
from ..models.content_block import ContentBlock

router = APIRouter(prefix="/api", tags=["content"])
settings = get_settings()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "env": settings.env,
        "openclaw": settings.openclaw_ws_url,
    }


@router.get("/config/public")
def public_config():
    return {
        "ue5_signaling_url": settings.ue5_signaling_url,
        "ue5_pixel_streamer_url": settings.ue5_pixel_streamer_url,
        "openclaw_model_default": settings.openclaw_model_default,
        "openclaw_model_agent": settings.openclaw_model_agent,
    }


@router.get("/content/{page}")
def get_page_content(page: str, db: Session = Depends(get_session)):
    """특정 page 의 모든 ContentBlock 을 slot 별로 그룹핑해 반환."""
    items = db.exec(
        select(ContentBlock).where(ContentBlock.page == page)
    ).all()
    items = sorted(items, key=lambda x: (x.slot, x.order_idx, x.key))

    slots: dict[str, dict[str, dict]] = {}
    for b in items:
        s = slots.setdefault(b.slot, {})
        s[b.key] = {"ko": b.value_ko, "en": b.value_en, "order": b.order_idx}

    return {"page": page, "slots": slots}
