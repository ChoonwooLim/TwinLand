"""TwinLand 종합 토지분석 보고서 모델."""
from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _gen_share_token() -> str:
    return uuid.uuid4().hex


class TwinlandReport(SQLModel, table=True):
    """사용자별 종합 토지분석 보고서 (1 report = 1+ parcels)."""

    __tablename__ = "twinland_report"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    title: str = Field(default="")
    summary: str = Field(default="")  # 한 줄 요약 (목록 표시용)

    # 입력 데이터
    parcels: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default="[]"),
    )
    # GIS 자동 수집 데이터 (VWorld·산림 SHP·slope·landuse 등)
    gis_data: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    # AI 합성 결과 (strengths/constraints/recommendations/checklist/section_prose)
    ai_synthesis: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )

    # 렌더링 결과
    html_content: str = Field(default="", sa_column=Column(Text))
    pdf_path: str | None = Field(default=None)

    # 공유 + 상태
    share_token: str = Field(default_factory=_gen_share_token, unique=True, index=True)
    status: str = Field(default="draft")  # draft | building | ready | error
    error_message: str | None = Field(default=None)

    # AI 모델·생성 메타
    ai_model_used: str | None = Field(default=None)
    generation_ms: int | None = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
