from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.ai_chat_log import AIChatLog
from ...models.download_log import DownloadLog
from ...models.email_log import EmailLog
from ...models.twinland_report import TwinlandReport
from ...models.user import User

router = APIRouter()


def _count(db: Session, model) -> int:
    return db.exec(select(func.count()).select_from(model)).one()


@router.get("/dashboard")
def dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_session)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = _count(db, User)
    total_reports = _count(db, TwinlandReport)
    reports_week = db.exec(
        select(func.count()).select_from(TwinlandReport).where(TwinlandReport.created_at >= week_ago)
    ).one()
    downloads_week = db.exec(
        select(func.count()).select_from(DownloadLog).where(DownloadLog.created_at >= week_ago)
    ).one()
    ai_chats_week = db.exec(
        select(func.count()).select_from(AIChatLog).where(AIChatLog.created_at >= week_ago)
    ).one()
    email_sent_week = db.exec(
        select(func.count()).select_from(EmailLog).where(EmailLog.created_at >= week_ago)
    ).one()

    # 최근 7일 일별 보고서 생성 시계열
    daily: list[dict] = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        rpt_cnt = db.exec(
            select(func.count()).select_from(TwinlandReport).where(
                TwinlandReport.created_at >= day_start, TwinlandReport.created_at < day_end
            )
        ).one()
        dl_cnt = db.exec(
            select(func.count()).select_from(DownloadLog).where(
                DownloadLog.created_at >= day_start, DownloadLog.created_at < day_end
            )
        ).one()
        daily.append({
            "date": day_start.strftime("%m-%d"),
            "reports": int(rpt_cnt),
            "downloads": int(dl_cnt),
        })

    # 최근 보고서 5개
    recent_reports = db.exec(
        select(TwinlandReport).order_by(TwinlandReport.created_at.desc()).limit(5)
    ).all()

    return {
        "stats": {
            "total_users": int(total_users),
            "total_reports": int(total_reports),
            "reports_week": int(reports_week),
            "downloads_week": int(downloads_week),
            "ai_chats_week": int(ai_chats_week),
            "email_sent_week": int(email_sent_week),
        },
        "daily": daily,
        "recent_reports": [
            {
                "id": r.id,
                "title": r.title,
                "summary": r.summary,
                "status": r.status,
                "parcel_count": len(r.parcels or []),
                "created_at": r.created_at.isoformat(),
            }
            for r in recent_reports
        ],
    }
