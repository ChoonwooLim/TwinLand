from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.ai_chat_log import AIChatLog
from ...models.contact_lead import ContactLead
from ...models.dataroom_doc import DataRoomDoc
from ...models.download_log import DownloadLog
from ...models.email_log import EmailLog
from ...models.upgrade_request import UpgradeRequest
from ...models.user import User

router = APIRouter()


def _count(db: Session, model) -> int:
    return db.exec(select(func.count()).select_from(model)).one()


@router.get("/dashboard")
def dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_session)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = _count(db, User)
    total_investors = db.exec(
        select(func.count()).select_from(User).where(User.role == "investor")
    ).one()
    pending_upgrades = db.exec(
        select(func.count()).select_from(UpgradeRequest).where(UpgradeRequest.status == "pending")
    ).one()
    total_leads = _count(db, ContactLead)
    new_leads_week = db.exec(
        select(func.count()).select_from(ContactLead).where(ContactLead.created_at >= week_ago)
    ).one()
    total_docs = _count(db, DataRoomDoc)
    downloads_week = db.exec(
        select(func.count()).select_from(DownloadLog).where(DownloadLog.created_at >= week_ago)
    ).one()
    ai_chats_week = db.exec(
        select(func.count()).select_from(AIChatLog).where(AIChatLog.created_at >= week_ago)
    ).one()
    email_sent_week = db.exec(
        select(func.count()).select_from(EmailLog).where(EmailLog.created_at >= week_ago)
    ).one()

    # 최근 7일 일별 시계열 (lead / download)
    daily: list[dict] = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        lead_cnt = db.exec(
            select(func.count()).select_from(ContactLead).where(
                ContactLead.created_at >= day_start, ContactLead.created_at < day_end
            )
        ).one()
        dl_cnt = db.exec(
            select(func.count()).select_from(DownloadLog).where(
                DownloadLog.created_at >= day_start, DownloadLog.created_at < day_end
            )
        ).one()
        daily.append({
            "date": day_start.strftime("%m-%d"),
            "leads": int(lead_cnt),
            "downloads": int(dl_cnt),
        })

    # 최근 리드 5개
    recent_leads = db.exec(select(ContactLead)).all()
    recent_leads = sorted(recent_leads, key=lambda x: x.created_at, reverse=True)[:5]
    recent_upgrades = db.exec(
        select(UpgradeRequest).where(UpgradeRequest.status == "pending")
    ).all()
    recent_upgrades = sorted(recent_upgrades, key=lambda x: x.created_at, reverse=True)[:5]

    return {
        "stats": {
            "total_users": int(total_users),
            "total_investors": int(total_investors),
            "pending_upgrades": int(pending_upgrades),
            "total_leads": int(total_leads),
            "new_leads_week": int(new_leads_week),
            "total_docs": int(total_docs),
            "downloads_week": int(downloads_week),
            "ai_chats_week": int(ai_chats_week),
            "email_sent_week": int(email_sent_week),
        },
        "daily": daily,
        "recent_leads": [l.model_dump() for l in recent_leads],
        "recent_upgrades": [u.model_dump() for u in recent_upgrades],
    }
