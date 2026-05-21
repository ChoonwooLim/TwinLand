"""Jinja2 로 종합 보고서 HTML 렌더링.

샘플 DATA/여주시_북내면_상교리_토지분석보고서_HTML.html 의 9-섹션 구조 기반:
  §1 핵심 결론 (강점/제약)
  §2 필지별 기본 현황 (테이블)
  §3 위치 + 2D/3D 지형
  §4 경사·재해 리스크
  §5 규제·인허가 (필지별 prose)
  §6 임업환경·활용 방향
  §7 업로드 파일 반영 내역
  §8 PDF 원문 첫 페이지 미리보기
  §9 최종 체크리스트
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "reports"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _fmt_int(v: Any) -> str:
    try:
        return f"{int(v):,}"
    except (TypeError, ValueError):
        return str(v) if v is not None else "—"


def _fmt_ha(m2: Any) -> str:
    try:
        return f"{float(m2) / 10000:.4f}"
    except (TypeError, ValueError):
        return "—"


_env.filters["fmt_int"] = _fmt_int
_env.filters["fmt_ha"] = _fmt_ha


def render(
    *,
    title: str,
    parcels: list[dict[str, Any]],
    summary: dict[str, Any],
    ai_synthesis: dict[str, Any],
    attachments: list[dict[str, Any]] | None = None,
    generated_at: str,
) -> str:
    template = _env.get_template("report.html")
    return template.render(
        title=title,
        parcels=parcels,
        summary=summary,
        ai=ai_synthesis,
        attachments=attachments or [],
        generated_at=generated_at,
    )
