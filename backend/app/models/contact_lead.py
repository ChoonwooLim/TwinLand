from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class ContactLead(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    source: str = Field(default="contact_form")  # contact_form / waitlist / referral
    stage: str = Field(default="new", index=True)  # new / contacting / meeting / diligence / contract / hold / closed
    message: str | None = None
    memo: str | None = None
    assigned_to: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
