from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.parcel import Parcel
from ...models.user import User

router = APIRouter()


class ParcelIn(BaseModel):
    code: str
    name: str | None = None
    zone: str | None = None
    area_sqm: float | None = None
    geometry_geojson: str | None = None
    status: str = "available"


@router.get("/parcels")
def list_parcels(admin: User = Depends(require_admin), db: Session = Depends(get_session)):
    items = db.exec(select(Parcel)).all()
    items = sorted(items, key=lambda x: x.code)
    return {"items": [p.model_dump() for p in items]}


@router.post("/parcels", status_code=201)
def create_parcel(
    body: ParcelIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    existing = db.exec(select(Parcel).where(Parcel.code == body.code)).first()
    if existing:
        raise HTTPException(status_code=409, detail="code exists")
    p = Parcel(**body.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p.model_dump()


@router.put("/parcels/{pid}")
def update_parcel(
    pid: int,
    body: ParcelIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    p = db.get(Parcel, pid)
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.add(p); db.commit(); db.refresh(p)
    return p.model_dump()


@router.delete("/parcels/{pid}", status_code=204)
def delete_parcel(
    pid: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    p = db.get(Parcel, pid)
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(p); db.commit()
