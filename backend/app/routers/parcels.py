from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from ..core.db import get_session
from ..models.parcel import Parcel

router = APIRouter(prefix="/api/parcels", tags=["parcels"])


@router.get("")
def list_parcels(db: Session = Depends(get_session)):
    items = db.exec(select(Parcel)).all()
    return {"items": [p.model_dump() for p in items], "count": len(items)}


@router.get("/{code}")
def get_parcel(code: str, db: Session = Depends(get_session)):
    p = db.exec(select(Parcel).where(Parcel.code == code)).first()
    return p.model_dump() if p else {"error": "not found"}
