from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class AIChatLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)
    session_id: str = Field(index=True)
    agent_id: str
    model: str
    prompt_chars: int = Field(default=0)
    response_chars: int = Field(default=0)
    latency_ms: int = Field(default=0)
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
