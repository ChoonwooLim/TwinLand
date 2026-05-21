"""HTML 보고서 → PDF 변환 (WeasyPrint).

WeasyPrint 가 시스템 의존성 (Pango/Cairo) 을 필요로 함 — Dockerfile 에
`libpango-1.0-0 libcairo2` 가 설치되어야 한다.

라이브러리 미설치 또는 변환 실패 시 graceful 에러 반환 (보고서 자체는 HTML 로 살아있음).
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("twinland.pdf_exporter")


def export(html: str, output_path: str | Path, base_url: str | None = None) -> tuple[str | None, str | None]:
    """HTML → PDF.

    Returns: (pdf_path, error_message). 성공 시 error_message=None.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        from weasyprint import HTML  # type: ignore
    except ImportError:
        return None, "WeasyPrint 미설치 — pip install weasyprint 후 재시도"
    except OSError as e:
        # Pango/Cairo 시스템 라이브러리 누락
        return None, f"WeasyPrint 시스템 의존성 누락: {e}"

    try:
        HTML(string=html, base_url=base_url).write_pdf(str(out))
    except Exception as e:
        logger.exception("PDF 변환 실패")
        return None, f"PDF 변환 실패: {e}"

    return str(out), None
