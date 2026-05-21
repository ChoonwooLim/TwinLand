from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class EmailLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    to_email: str = Field(index=True)
    subject: str
    template: str = Field(index=True)
    body_html: str | None = None
    status: str = Field(default="queued", index=True)  # queued / sent / failed / logged
    provider_id: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
