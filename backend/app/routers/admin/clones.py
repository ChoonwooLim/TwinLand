from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.clone import Clone
from ...models.pet import Pet
from ...models.user import User

router = APIRouter()


@router.get("/clones")
def list_clones(admin: User = Depends(require_admin), db: Session = Depends(get_session)):
    pets = db.exec(select(Pet)).all()
    pets_by_id = {p.id: p for p in pets}
    users_by_id = {u.id: u for u in db.exec(select(User)).all()}
    clones = db.exec(select(Clone)).all()

    rows = []
    for c in clones:
        pet = pets_by_id.get(c.pet_id)
        owner = users_by_id.get(pet.owner_id) if pet else None
        rows.append({
            "id": c.id,
            "pet_id": c.pet_id,
            "pet_name": pet.name if pet else None,
            "pet_species": pet.species if pet else None,
            "is_memorial": pet.is_memorial if pet else None,
            "owner_email": owner.email if owner else None,
            "version": c.version,
            "model_ref": c.model_ref,
            "created_at": c.created_at.isoformat(),
        })
    rows = sorted(rows, key=lambda r: r["created_at"], reverse=True)

    pet_rows = []
    for p in pets:
        owner = users_by_id.get(p.owner_id)
        pet_rows.append({
            "id": p.id,
            "name": p.name,
            "species": p.species,
            "breed": p.breed,
            "is_memorial": p.is_memorial,
            "owner_email": owner.email if owner else None,
            "has_clone": any(c.pet_id == p.id for c in clones),
            "created_at": p.created_at.isoformat(),
        })
    pet_rows = sorted(pet_rows, key=lambda r: r["created_at"], reverse=True)

    return {"clones": rows, "pets": pet_rows}
