from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.email_log import EmailLog
from ...models.user import User
from ...services.email import resend

router = APIRouter()


@router.get("/emails")
def list_emails(
    status: str | None = None,
    template: str | None = None,
    limit: int = 200,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(EmailLog)
    if status and status != "all":
        q = q.where(EmailLog.status == status)
    if template and template != "all":
        q = q.where(EmailLog.template == template)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)[: max(1, min(limit, 1000))]
    return {"items": [i.model_dump() for i in items]}


@router.post("/emails/{log_id}/resend")
def resend_email(
    log_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    try:
        log = resend(db, log_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="not found")
    return log.model_dump()
