from datetime import datetime, date, timezone
from sqlmodel import SQLModel, Field


class Pet(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    name: str
    species: str = Field(default="dog")
    breed: str | None = None
    birthdate: date | None = None
    is_memorial: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
