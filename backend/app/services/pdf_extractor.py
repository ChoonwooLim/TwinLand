"""업로드된 PDF 의 텍스트 추출 (AI 합성 입력용).

* pypdf 로 텍스트 추출 (스캔 PDF 면 빈 결과 반환).
* 최대 N 페이지 + 최대 M 문자 까지만 추출 (OpenClaw 컨텍스트 한계 고려).
* 추후 OCR (Tesseract/EasyOCR) 통합 여지 — 현재는 텍스트 PDF 만 지원.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("twinland.pdf_extractor")

MAX_PAGES = 15
MAX_CHARS_PER_PDF = 30_000


def classify_filename(name: str) -> str:
    """파일명으로 보고서 유형 추정."""
    n = name.lower()
    if "필지" in name or "parcel" in n:
        return "필지분석"
    if "산지" in name or "forest" in n or "mountain" in n:
        return "산지정보"
    if "토지이용" in name or "landuse" in n or "land_use" in n:
        return "토지이용"
    if "경사" in name or "slope" in n:
        return "경사도"
    return "기타"


def extract_text(pdf_path: str | Path) -> tuple[str, str | None]:
    """PDF → (extracted_text, error_message).

    error_message 가 None 이면 정상.
    pypdf 미설치 시 또는 추출 실패 시 빈 텍스트 + 에러 메시지.
    """
    p = Path(pdf_path)
    if not p.is_file():
        return "", f"파일 없음: {pdf_path}"

    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        logger.warning("pypdf not installed; skipping extraction for %s", pdf_path)
        return "", "pypdf 미설치 — pip install pypdf 후 재시도"

    try:
        reader = PdfReader(str(p))
    except Exception as e:
        return "", f"PDF 파싱 실패: {e}"

    chunks: list[str] = []
    total = 0
    for i, page in enumerate(reader.pages[:MAX_PAGES]):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            logger.warning("page %d extract failed: %s", i, e)
            continue
        if not text.strip():
            continue
        chunks.append(f"[p.{i+1}] {text.strip()}")
        total += len(text)
        if total >= MAX_CHARS_PER_PDF:
            break

    extracted = "\n\n".join(chunks).strip()
    if not extracted:
        return "", "텍스트 추출 결과 비어있음 (스캔 PDF 일 가능성)"
    return extracted, None
