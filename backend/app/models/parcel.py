from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class Parcel(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    name: str | None = None
    zone: str | None = None
    area_sqm: float | None = None
    geometry_geojson: str | None = None
    status: str = Field(default="available")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
