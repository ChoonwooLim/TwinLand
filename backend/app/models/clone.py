from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class Clone(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    pet_id: int = Field(foreign_key="pet.id", index=True)
    version: int = Field(default=1)
    model_ref: str | None = None
    personality_json: str | None = None
    voice_sample_url: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
