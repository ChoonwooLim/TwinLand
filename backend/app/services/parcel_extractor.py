"""업로드 파일 → 필지(동/리·지번) 목록 추출.

지목·면적 등 권위 속성은 추출하지 않는다(프론트의 VWorld 자동조회가 담당).
LLM 호출은 OpenClaw LAN 게이트웨이만 사용 — API 키 금지.
"""
from __future__ import annotations

import csv
import io
import json
import re

# 전각 숫자/하이픈 → 반각
_FULLWIDTH = {ord("０") + i: chr(ord("0") + i) for i in range(10)}
_FULLWIDTH[ord("－")] = "-"
_FULLWIDTH[ord("—")] = "-"

# 지번 형태: (산)? 숫자 (-숫자)?
LOT_RE = re.compile(r"산?\s?\d+(?:\s?-\s?\d+)?")


def normalize_lot(s: str) -> str:
    s = (s or "").translate(_FULLWIDTH).strip()
    s = re.sub(r"\s+", "", s)              # 내부 공백 제거 ("산 31" → "산31")
    return s


def lenient_json(text: str):
    """LLM 응답에서 JSON 배열을 관대하게 파싱. 실패 시 None."""
    if not text:
        return None
    t = text.strip()
    # 코드펜스 제거
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    # 첫 '[' ~ 마지막 ']' 슬라이스
    i, j = t.find("["), t.rfind("]")
    if i != -1 and j != -1 and j > i:
        try:
            return json.loads(t[i : j + 1])
        except Exception:
            return None
    return None


class ExtractError(ValueError):
    pass


# 헤더 후보 (소문자/공백제거 비교)
_LOT_HEADERS = {"지번", "지번주소", "번지", "지번번호", "lot", "jibun", "본번부번"}
_LOC_HEADERS = {"동리", "동/리", "리", "소재지", "법정동", "location", "동", "읍면동"}


def _pick_col(header: list[str], candidates: set[str]) -> int:
    for i, h in enumerate(header):
        key = re.sub(r"\s+", "", (h or "")).lower()
        if key in candidates:
            return i
    return -1


def _rows_from_table(table: list[list[str]]) -> list[dict]:
    if not table:
        raise ExtractError("빈 표")
    header = [str(c) for c in table[0]]
    lot_i = _pick_col(header, _LOT_HEADERS)
    if lot_i == -1:
        raise ExtractError("지번 컬럼을 찾지 못함 (헤더: %s)" % header)
    loc_i = _pick_col(header, _LOC_HEADERS)
    out = []
    for raw in table[1:]:
        if lot_i >= len(raw):
            continue
        lot = normalize_lot(str(raw[lot_i] or ""))
        if not lot:
            continue
        loc = ""
        if loc_i != -1 and loc_i < len(raw):
            loc = str(raw[loc_i] or "").strip()
        out.append({"location": loc, "lot": lot})
    return out


def extract_tabular(data: bytes, ext: str) -> list[dict]:
    if ext == "csv":
        text = data.decode("utf-8-sig", errors="replace")
        table = [row for row in csv.reader(io.StringIO(text))]
    elif ext in ("xlsx", "xlsm"):
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.active
        table = [[("" if c is None else c) for c in row] for row in ws.iter_rows(values_only=True)]
    else:
        raise ExtractError(f"지원하지 않는 표 형식: {ext}")
    return _rows_from_table(table)


def extract_lots_from_text(text: str) -> list[dict]:
    """텍스트(텍스트PDF 추출 결과)에서 지번 후보를 정규식으로 수집(중복 제거, 순서 유지)."""
    seen = set()
    out = []
    for m in LOT_RE.finditer(text or ""):
        lot = normalize_lot(m.group(0))
        # 단독 1~2자리 숫자는 NO(행번호)일 확률 높지만, 보수적으로 유지하되 중복만 제거
        if lot and lot not in seen:
            seen.add(lot)
            out.append({"location": "", "lot": lot})
    return out


def extract_text_pdf(data: bytes) -> tuple[list[dict], bool]:
    """텍스트 PDF → (rows, is_scanned). 텍스트가 비면 스캔으로 간주(rows=[], True)."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    chunks = []
    for page in reader.pages[:15]:
        try:
            t = page.extract_text() or ""
        except Exception:
            continue
        if t.strip():
            chunks.append(t)
    text = "\n".join(chunks).strip()
    if not text:
        return [], True
    return extract_lots_from_text(text), False
