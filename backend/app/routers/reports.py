"""TwinLand 종합 토지분석 보고서 API.

엔드포인트:
  POST   /api/reports/build            보고서 생성 (동기, 30-60초)
  GET    /api/reports                  로그인 사용자의 보고서 목록
  GET    /api/reports/{id}             보고서 메타 + ai_synthesis
  GET    /api/reports/{id}/html        렌더링된 HTML 본문
  GET    /api/reports/{id}/pdf         PDF 다운로드 (있을 때)
  DELETE /api/reports/{id}             삭제 (본인만)
  GET    /api/reports/share/{token}    공유 토큰으로 HTML 조회 (로그인 불필요)

  POST   /api/reports/attachments      첨부 PDF 업로드 (보고서 빌드 전 사전 업로드)
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, select

from ..core.db import get_session
from ..core.deps import current_user, optional_user
from ..models.twinland_report import TwinlandReport
from ..models.twinland_report_attachment import TwinlandReportAttachment
from ..models.user import User
from ..services import pdf_extractor, report_builder

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _uploads_root() -> Path:
    env_val = (os.getenv("UPLOAD_DIR") or "").strip()
    return Path(env_val) if env_val else Path(__file__).resolve().parent.parent.parent / "uploads"


# ── 스키마 ───────────────────────────────────────────────


class ParcelInput(BaseModel):
    no: int | None = None
    pnu: str | None = None
    address: str | None = None
    lot: str
    location: str
    category: str = "—"
    area_m2: float = 0
    area_pyeong: float | None = None
    owner: str | None = None
    memo: str | None = None
    geometry: dict[str, Any] | None = None
    centroid: list[float] | None = None
    slope_stats: dict[str, Any] | None = None
    landslide_class_dist: dict[str, Any] | None = None
    forest: dict[str, Any] | None = None
    landuse: dict[str, Any] | None = None


class BuildRequest(BaseModel):
    title: str | None = None
    parcels: list[ParcelInput] = Field(default_factory=list)
    attachment_ids: list[int] = Field(default_factory=list)
    ai_model: str | None = None


class ReportSummary(BaseModel):
    id: int
    title: str
    summary: str
    status: str
    parcel_count: int
    share_token: str
    has_pdf: bool
    created_at: str
    updated_at: str


class ReportDetail(ReportSummary):
    parcels: list[dict[str, Any]]
    gis_data: dict[str, Any]
    ai_synthesis: dict[str, Any]
    error_message: str | None
    ai_model_used: str | None
    generation_ms: int | None


class AttachmentOut(BaseModel):
    id: int
    original_name: str
    stored_path: str
    file_type: str
    file_size: int
    has_extracted_text: bool


def _summary(r: TwinlandReport) -> ReportSummary:
    return ReportSummary(
        id=r.id or 0,
        title=r.title,
        summary=r.summary,
        status=r.status,
        parcel_count=len(r.parcels or []),
        share_token=r.share_token,
        has_pdf=bool(r.pdf_path),
        created_at=r.created_at.isoformat(),
        updated_at=r.updated_at.isoformat(),
    )


def _detail(r: TwinlandReport) -> ReportDetail:
    s = _summary(r)
    return ReportDetail(
        **s.model_dump(),
        parcels=r.parcels or [],
        gis_data=r.gis_data or {},
        ai_synthesis=r.ai_synthesis or {},
        error_message=r.error_message,
        ai_model_used=r.ai_model_used,
        generation_ms=r.generation_ms,
    )


# ── 첨부 업로드 ───────────────────────────────────────────


@router.post("/attachments", response_model=AttachmentOut)
async def upload_attachment(
    file: UploadFile = File(...),
    file_type: str = Form("기타"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> AttachmentOut:
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일 이름 누락")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일")
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기 초과 (30MB)")

    # 보고서 생성 전이므로 user_id 기준 staging 디렉토리에 저장
    uid = uuid.uuid4().hex
    staging = _uploads_root() / "reports" / "_staging" / str(user.id)
    staging.mkdir(parents=True, exist_ok=True)
    disk_path = staging / f"{uid}.pdf"
    disk_path.write_bytes(content)

    cls = file_type if file_type and file_type != "기타" else pdf_extractor.classify_filename(file.filename)
    # 텍스트 즉시 추출 (보고서 빌드 단계 단축)
    text, err = pdf_extractor.extract_text(disk_path)

    record = TwinlandReportAttachment(
        report_id=0,  # 빌드 시 갱신
        original_name=file.filename,
        stored_path=f"/uploads/reports/_staging/{user.id}/{uid}.pdf",
        file_type=cls,
        file_size=len(content),
        extracted_text=text,
        extraction_error=err,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return AttachmentOut(
        id=record.id or 0,
        original_name=record.original_name,
        stored_path=record.stored_path,
        file_type=record.file_type,
        file_size=record.file_size,
        has_extracted_text=bool(record.extracted_text),
    )


# ── 보고서 빌드 ────────────────────────────────────────────


@router.post("/build", response_model=ReportDetail)
def build_report(
    body: BuildRequest,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> ReportDetail:
    if not body.parcels:
        raise HTTPException(status_code=400, detail="필지를 1개 이상 입력하세요")

    parcels_input = [p.model_dump() for p in body.parcels]
    try:
        report = report_builder.build(
            session=session,
            user_id=user.id or 0,
            parcels_input=parcels_input,
            title_override=body.title,
            attachment_ids=body.attachment_ids,
            ai_model=body.ai_model,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보고서 빌드 실패: {e}")
    return _detail(report)


# ── 조회·삭제 ──────────────────────────────────────────────


@router.get("", response_model=list[ReportSummary])
def list_reports(
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> list[ReportSummary]:
    rows = session.exec(
        select(TwinlandReport)
        .where(TwinlandReport.user_id == user.id)
        .order_by(desc(TwinlandReport.created_at))
    ).all()
    return [_summary(r) for r in rows]


@router.get("/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: int,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> ReportDetail:
    r = session.get(TwinlandReport, report_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="보고서 없음")
    return _detail(r)


@router.get("/{report_id}/html", response_class=HTMLResponse)
def get_report_html(
    report_id: int,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> HTMLResponse:
    r = session.get(TwinlandReport, report_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="보고서 없음")
    return HTMLResponse(content=r.html_content)


@router.get("/{report_id}/pdf")
def get_report_pdf(
    report_id: int,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    r = session.get(TwinlandReport, report_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="보고서 없음")
    if not r.pdf_path:
        raise HTTPException(status_code=404, detail="PDF 미생성")
    # /uploads/... 경로를 디스크 경로로
    disk = _uploads_root() / r.pdf_path.removeprefix("/uploads/")
    if not disk.is_file():
        raise HTTPException(status_code=404, detail=f"PDF 파일 없음: {disk}")
    return FileResponse(
        path=disk,
        media_type="application/pdf",
        filename=f"{r.title or 'report'}.pdf",
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    r = session.get(TwinlandReport, report_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="보고서 없음")
    # 첨부 cascade
    atts = session.exec(
        select(TwinlandReportAttachment).where(TwinlandReportAttachment.report_id == report_id)
    ).all()
    for a in atts:
        session.delete(a)
    session.delete(r)
    session.commit()


# ── 공유 (로그인 불필요) ─────────────────────────────────────


@router.get("/share/{token}", response_class=HTMLResponse)
def get_shared_report(
    token: str,
    session: Session = Depends(get_session),
    _maybe_user: User | None = Depends(optional_user),
) -> HTMLResponse:
    r = session.exec(
        select(TwinlandReport).where(TwinlandReport.share_token == token)
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="공유 보고서 없음")
    return HTMLResponse(content=r.html_content)
