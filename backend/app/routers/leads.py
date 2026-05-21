from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ..core.config import get_settings
from ..core.db import get_session
from ..core.deps import require_admin
from ..models.contact_lead import ContactLead
from ..models.user import User
from ..services.email import send_email

router = APIRouter(prefix="/api/leads", tags=["leads"])
settings = get_settings()

STAGES = ("new", "contacting", "meeting", "diligence", "contract", "hold", "closed")


class LeadIn(BaseModel):
    email: EmailStr
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    message: str | None = None
    source: str = "contact_form"


class LeadUpdateIn(BaseModel):
    stage: Literal["new", "contacting", "meeting", "diligence", "contract", "hold", "closed"] | None = None
    memo: str | None = None
    assigned_to: int | None = None


@router.post("", status_code=201)
def create_lead(body: LeadIn, db: Session = Depends(get_session)):
    lead = ContactLead(
        email=body.email,
        name=body.name,
        phone=body.phone,
        company=body.company,
        message=body.message,
        source=body.source,
        stage="new",
    )
    db.add(lead); db.commit(); db.refresh(lead)

    try:
        send_email(db, body.email, "lead_received", {
            "name": body.name,
            "email": body.email,
        })
        send_email(db, settings.admin_email, "admin_new_lead", {
            "name": body.name,
            "email": body.email,
            "company": body.company,
            "phone": body.phone,
            "source": body.source,
            "message": body.message,
            "admin_url": f"{settings.frontend_url}/admin/leads",
        })
    except Exception:
        pass

    return {"ok": True, "id": lead.id}


# ── admin ──

@router.get("/admin")
def admin_list(
    stage: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(ContactLead)
    if stage and stage != "all" and stage in STAGES:
        q = q.where(ContactLead.stage == stage)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)
    return {"items": [i.model_dump() for i in items], "count": len(items), "stages": list(STAGES)}


@router.get("/admin/{lead_id}")
def admin_detail(
    lead_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    lead = db.get(ContactLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="not found")
    return lead.model_dump()


@router.put("/admin/{lead_id}")
def admin_update(
    lead_id: int,
    body: LeadUpdateIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    lead = db.get(ContactLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="not found")
    if body.stage is not None:
        lead.stage = body.stage
    if body.memo is not None:
        lead.memo = body.memo
    if body.assigned_to is not None:
        lead.assigned_to = body.assigned_to
    lead.updated_at = datetime.now(timezone.utc)
    db.add(lead); db.commit(); db.refresh(lead)
    return lead.model_dump()


@router.delete("/admin/{lead_id}", status_code=204)
def admin_delete(
    lead_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    lead = db.get(ContactLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(lead); db.commit()
