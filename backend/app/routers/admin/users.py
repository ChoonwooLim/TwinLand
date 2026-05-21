from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...core.security import ROLE_ORDER
from ...models.user import User

router = APIRouter()


@router.get("/users")
def list_users(
    q: str | None = None,
    role: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    items = db.exec(select(User)).all()
    if q:
        ql = q.lower()
        items = [u for u in items if ql in (u.email or "").lower() or ql in ((u.display_name or "")).lower()]
    if role and role != "all":
        items = [u for u in items if u.role == role]
    items = sorted(items, key=lambda x: x.created_at, reverse=True)
    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "display_name": u.display_name,
                "phone": u.phone,
                "company": u.company,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            }
            for u in items
        ]
    }


class RoleIn(BaseModel):
    role: str


@router.put("/users/{uid}/role")
def set_role(
    uid: int,
    body: RoleIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    if body.role not in ROLE_ORDER:
        raise HTTPException(status_code=400, detail="invalid role")

    # admin 승격/회수는 superadmin 만
    if (body.role == "admin" or body.role == "superadmin") and admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="only superadmin can grant admin role")

    target = db.get(User, uid)
    if not target:
        raise HTTPException(status_code=404, detail="user not found")
    # superadmin 회수는 본인만 자기 자신에게는 불가 (셀프 락아웃 방지)
    if target.role == "superadmin" and admin.id == target.id:
        raise HTTPException(status_code=400, detail="cannot downgrade self")

    target.role = body.role
    db.add(target); db.commit(); db.refresh(target)
    return {"ok": True, "id": target.id, "role": target.role}


class ActiveIn(BaseModel):
    is_active: bool


@router.put("/users/{uid}/active")
def set_active(
    uid: int,
    body: ActiveIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    target = db.get(User, uid)
    if not target:
        raise HTTPException(status_code=404, detail="not found")
    if target.id == admin.id and not body.is_active:
        raise HTTPException(status_code=400, detail="cannot disable self")
    target.is_active = body.is_active
    db.add(target); db.commit(); db.refresh(target)
    return {"ok": True, "id": target.id, "is_active": target.is_active}


@router.delete("/users/{uid}", status_code=204)
def delete_user(
    uid: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    target = db.get(User, uid)
    if not target:
        raise HTTPException(status_code=404, detail="not found")
    if target.role == "superadmin":
        raise HTTPException(status_code=403, detail="cannot delete superadmin")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="cannot delete self")
    db.delete(target); db.commit()
