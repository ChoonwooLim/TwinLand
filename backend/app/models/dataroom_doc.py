from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class DataRoomDoc(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    file_type: str
    size_bytes: int | None = None
    path: str | None = None
    access_level: str = Field(default="investor")  # public / investor / admin
    uploaded_by: int | None = Field(default=None, foreign_key="user.id")
    version: int = Field(default=1)
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
