from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel

from ..core.db import get_session
from ..core.deps import current_user
from ..models.pet import Pet
from ..models.user import User

router = APIRouter(prefix="/api/pets", tags=["pets"])


class PetIn(BaseModel):
    name: str
    species: str = "dog"
    breed: str | None = None


@router.get("")
def list_my_pets(user: User = Depends(current_user), db: Session = Depends(get_session)):
    items = db.exec(select(Pet).where(Pet.owner_id == user.id)).all()
    return {"items": [p.model_dump() for p in items]}


@router.post("", status_code=201)
def create_pet(body: PetIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    pet = Pet(owner_id=user.id, name=body.name, species=body.species, breed=body.breed)
    db.add(pet); db.commit(); db.refresh(pet)
    return pet.model_dump()
