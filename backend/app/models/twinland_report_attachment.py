"""보고서 첨부 PDF (사용자 업로드 필지분석·산지정보·토지이용계획 등)."""
from datetime import datetime

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class TwinlandReportAttachment(SQLModel, table=True):
    """보고서 1개에 N개의 첨부 PDF.

    PDF 텍스트는 추출하여 `extracted_text` 에 저장 — AI 합성 단계 입력으로 사용.
    """

    __tablename__ = "twinland_report_attachment"

    id: int | None = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="twinland_report.id", index=True)

    original_name: str  # "필지분석결과서_..._384-18.pdf"
    stored_path: str    # "/uploads/reports/{report_id}/{uuid}.pdf"
    file_type: str = Field(default="기타")  # 필지분석 | 산지정보 | 토지이용 | 경사도 | 기타
    file_size: int = Field(default=0)

    # 추출 텍스트 (AI 입력용). PDF 처음 N 페이지에서만 추출.
    extracted_text: str = Field(default="", sa_column=Column(Text))
    extraction_error: str | None = Field(default=None)

    # PDF 첫 페이지 썸네일 (보고서 §8 미리보기용).
    # 저장 경로: /uploads/reports/{report_id}/{uuid}_thumb.png
    thumbnail_path: str | None = Field(default=None)

    uploaded_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
