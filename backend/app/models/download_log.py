from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class DownloadLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    doc_id: int = Field(foreign_key="dataroomdoc.id", index=True)
    ip: str | None = None
    user_agent: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
