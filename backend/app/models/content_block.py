from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class ContentBlock(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    page: str = Field(index=True)  # home / investment / ...
    slot: str = Field(index=True)  # hero_stats / roadmap / team / financials
    key: str  # phase1_title, member1_name, ...
    value_ko: str = Field(default="")
    value_en: str = Field(default="")
    order_idx: int = Field(default=0)
    updated_by: int | None = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
