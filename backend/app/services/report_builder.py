"""보고서 빌드 오케스트레이터 (동기 파이프라인).

플로우:
  1) spatial_collector.collect → 정규화 + 합산
  2) pdf_extractor.extract_text (첨부 PDF 각각)
  3) ai_synthesizer.synthesize → strengths/constraints/recommendations/...
  4) template_renderer.render → HTML
  5) (선택) pdf_exporter.export → PDF 파일
  6) DB 에 TwinlandReport upsert
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import Session

from ..models.twinland_report import TwinlandReport
from ..models.twinland_report_attachment import TwinlandReportAttachment
from . import (
    ai_synthesizer,
    pdf_exporter,
    pdf_extractor,
    spatial_collector,
    template_renderer,
)

logger = logging.getLogger("twinland.report_builder")


def _uploads_dir() -> Path:
    env_val = (os.getenv("UPLOAD_DIR") or "").strip()
    base = Path(env_val) if env_val else Path(__file__).resolve().parent.parent.parent / "uploads"
    target = base / "reports"
    target.mkdir(parents=True, exist_ok=True)
    return target


def _extract_attachments(report_id: int, atts: list[TwinlandReportAttachment]) -> list[dict[str, str]]:
    """첨부 PDF 들의 추출 텍스트를 AI 입력 포맷으로 변환 + DB 캐시."""
    result: list[dict[str, str]] = []
    for att in atts:
        if not att.extracted_text:
            # 아직 추출 안 됐으면 지금 추출
            full = Path(att.stored_path)
            # stored_path 가 /uploads/... 형태면 실제 디스크 경로로 변환
            if str(full).startswith("/uploads/"):
                base = (os.getenv("UPLOAD_DIR") or "").strip()
                disk = Path(base) if base else Path(__file__).resolve().parent.parent.parent / "uploads"
                full = disk / str(att.stored_path).removeprefix("/uploads/")
            text, err = pdf_extractor.extract_text(full)
            att.extracted_text = text
            att.extraction_error = err
        if att.extracted_text:
            result.append({"type": att.file_type, "name": att.original_name, "text": att.extracted_text})
    return result


def build(
    *,
    session: Session,
    user_id: int,
    parcels_input: list[dict[str, Any]],
    title_override: str | None = None,
    attachment_ids: list[int] | None = None,
    ai_model: str | None = None,
) -> TwinlandReport:
    """동기 빌드. 30-60초 소요 (OpenClaw 호출 포함).

    파라미터:
      parcels_input: 프론트에서 보낸 정규화 전 필지 리스트
      attachment_ids: 사전 업로드된 첨부 ID 목록 (선택)
      title_override: 사용자 지정 제목 (없으면 AI 가 생성)
    """
    started = time.time()

    # 1) 수집
    collected = spatial_collector.collect(parcels_input)
    parcels = collected["parcels"]
    summary = collected["summary"]

    # 2) 첨부 PDF 텍스트
    atts: list[TwinlandReportAttachment] = []
    attachments_text: list[dict[str, str]] = []
    if attachment_ids:
        from sqlmodel import select
        atts = list(
            session.exec(
                select(TwinlandReportAttachment).where(
                    TwinlandReportAttachment.id.in_(attachment_ids)  # type: ignore[attr-defined]
                )
            ).all()
        )
        attachments_text = _extract_attachments(0, atts)

    # 3) AI 합성
    ai_result = ai_synthesizer.synthesize(parcels, summary, attachments_text, model=ai_model)

    title = title_override or ai_result.get("title") or f"{parcels[0].get('location','대상')} 종합 토지분석 보고서"

    # 4) HTML 렌더
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    html = template_renderer.render(
        title=title,
        parcels=parcels,
        summary=summary,
        ai_synthesis=ai_result,
        attachments=[
            {
                "id": a.id,
                "name": a.original_name,
                "type": a.file_type,
                "thumbnail": a.thumbnail_path,
            }
            for a in atts
        ],
        generated_at=generated_at,
    )

    # 5) DB upsert (먼저 저장해 id 확보)
    report = TwinlandReport(
        user_id=user_id,
        title=title,
        summary=ai_result.get("summary", ""),
        parcels=parcels,
        gis_data={"summary": summary},
        ai_synthesis=ai_result,
        html_content=html,
        status="ready",
        ai_model_used=ai_model,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    # 6) 첨부 report_id 갱신
    if atts:
        for a in atts:
            a.report_id = report.id  # type: ignore[assignment]
            session.add(a)
        session.commit()

    # 7) PDF 변환 (선택)
    pdf_dir = _uploads_dir() / str(report.id)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdf_path, pdf_err = pdf_exporter.export(html, pdf_dir / "report.pdf")
    if pdf_path:
        report.pdf_path = f"/uploads/reports/{report.id}/report.pdf"
        session.add(report)
        session.commit()
        session.refresh(report)
    else:
        logger.info("PDF 변환 스킵: %s", pdf_err)

    report.generation_ms = int((time.time() - started) * 1000)
    session.add(report)
    session.commit()
    session.refresh(report)

    return report
