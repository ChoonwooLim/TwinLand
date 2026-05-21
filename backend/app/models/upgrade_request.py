from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class UpgradeRequest(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    realname: str
    phone: str
    company: str | None = None
    purpose: str
    status: str = Field(default="pending", index=True)  # pending / approved / rejected
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    reject_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
