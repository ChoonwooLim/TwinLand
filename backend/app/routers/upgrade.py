from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..core.config import get_settings
from ..core.db import get_session
from ..core.deps import current_user, require_admin
from ..models.upgrade_request import UpgradeRequest
from ..models.user import User
from ..services.email import send_email

router = APIRouter(prefix="/api/upgrade", tags=["upgrade"])
settings = get_settings()


class UpgradeRequestIn(BaseModel):
    realname: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=1, max_length=40)
    company: str | None = None
    purpose: str = Field(min_length=1, max_length=1000)


class UpgradeReviewIn(BaseModel):
    reason: str | None = None


@router.post("/request", status_code=201)
def request_upgrade(
    body: UpgradeRequestIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_session),
):
    if user.role in ("investor", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="already eligible")

    # 이미 대기중인 요청 금지
    existing = db.exec(
        select(UpgradeRequest).where(
            UpgradeRequest.user_id == user.id, UpgradeRequest.status == "pending"
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="pending request already exists")

    req = UpgradeRequest(
        user_id=user.id,
        realname=body.realname,
        phone=body.phone,
        company=body.company,
        purpose=body.purpose,
    )
    db.add(req); db.commit(); db.refresh(req)

    # 사용자 프로필에도 정보 반영
    user.phone = user.phone or body.phone
    user.company = user.company or body.company
    db.add(user); db.commit()

    # 사용자 + 관리자 알림 이메일
    try:
        send_email(db, user.email, "upgrade_requested", {
            "realname": body.realname,
            "from_email": settings.email_from,
        })
        send_email(db, settings.admin_email, "admin_new_upgrade", {
            "realname": body.realname,
            "email": user.email,
            "phone": body.phone,
            "company": body.company,
            "purpose": body.purpose,
            "admin_url": f"{settings.frontend_url}/admin/upgrades",
        })
    except Exception:
        pass

    return req.model_dump()


@router.get("/mine")
def my_requests(user: User = Depends(current_user), db: Session = Depends(get_session)):
    items = db.exec(
        select(UpgradeRequest).where(UpgradeRequest.user_id == user.id)
    ).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)
    return {"items": [i.model_dump() for i in items]}


# ── admin ──

@router.get("/admin/list")
def admin_list(
    status_filter: str = "pending",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(UpgradeRequest)
    if status_filter and status_filter != "all":
        q = q.where(UpgradeRequest.status == status_filter)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)
    # 유저 정보 병합
    user_ids = [i.user_id for i in items]
    users_by_id = {u.id: u for u in db.exec(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    enriched = []
    for r in items:
        u = users_by_id.get(r.user_id)
        d = r.model_dump()
        d["email"] = u.email if u else None
        d["user_role"] = u.role if u else None
        enriched.append(d)
    return {"items": enriched, "count": len(enriched)}


@router.post("/admin/{req_id}/approve")
def admin_approve(
    req_id: int,
    body: UpgradeReviewIn | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    req = db.get(UpgradeRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="already reviewed")

    user = db.get(User, req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    user.role = "investor"
    user.phone = req.phone or user.phone
    user.company = req.company or user.company
    user.display_name = user.display_name or req.realname
    db.add(user)

    req.status = "approved"
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.add(req)
    db.commit()

    try:
        send_email(db, user.email, "upgrade_approved", {
            "realname": req.realname,
            "email": user.email,
            "display_name": user.display_name,
            "dataroom_url": f"{settings.frontend_url}/dataroom",
        })
    except Exception:
        pass

    return {"ok": True, "user_id": user.id, "role": user.role}


@router.post("/admin/{req_id}/reject")
def admin_reject(
    req_id: int,
    body: UpgradeReviewIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    req = db.get(UpgradeRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="already reviewed")

    req.status = "rejected"
    req.reject_reason = body.reason
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.add(req); db.commit()

    user = db.get(User, req.user_id)
    if user:
        try:
            send_email(db, user.email, "upgrade_rejected", {
                "realname": req.realname,
                "email": user.email,
                "reject_reason": body.reason or "-",
                "from_email": settings.email_from,
            })
        except Exception:
            pass

    return {"ok": True}
