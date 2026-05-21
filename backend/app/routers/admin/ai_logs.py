from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.ai_chat_log import AIChatLog
from ...models.user import User

router = APIRouter()


@router.get("/ai-logs")
def list_logs(
    model: str | None = None,
    session_id: str | None = None,
    limit: int = 200,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(AIChatLog)
    if model:
        q = q.where(AIChatLog.model == model)
    if session_id:
        q = q.where(AIChatLog.session_id == session_id)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)[: max(1, min(limit, 1000))]

    # 모델별 집계
    by_model_raw = db.exec(
        select(AIChatLog.model, func.count()).group_by(AIChatLog.model)
    ).all()
    by_model = [{"model": m, "count": int(c)} for m, c in by_model_raw]

    return {
        "items": [i.model_dump() for i in items],
        "by_model": by_model,
    }
