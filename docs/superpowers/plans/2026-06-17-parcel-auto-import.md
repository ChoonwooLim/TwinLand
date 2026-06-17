# 새 프로젝트 + 파일 기반 필지 자동 입력 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 프로젝트 생성 버튼과, 이미지·PDF·엑셀/CSV 파일을 업로드하면 필지(동/리·지번) 목록을 자동 추출해 편집 표를 채우는 기능을 추가한다.

**Architecture:** legacy-map 정적 앱이 단일 백엔드 엔드포인트 `POST /api/ai/extract-parcels` 로 파일을 올리면, 백엔드가 종류별(표=openpyxl/csv, 텍스트PDF=pypdf, 이미지/스캔PDF=OpenClaw 비전)로 동/리·지번만 추출해 반환한다. 지목·면적 등 권위 속성은 기존 editor 의 VWorld 자동조회를 그대로 재사용한다.

**Tech Stack:** FastAPI + pydantic / openpyxl + pypdf / OpenClaw LAN WebSocket(비전) / 정적 JS(legacy-map) — 빌드 없이 `node --check` 로 검증.

**설계서:** `docs/superpowers/specs/2026-06-17-parcel-auto-import-design.md`

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `backend/requirements.txt` | `openpyxl`, `pytest` 추가 | 수정 |
| `backend/tests/conftest.py` | pytest fixture (TestClient) | 신규 |
| `backend/tests/test_parcel_extractor.py` | 추출 서비스 단위 테스트 | 신규 |
| `backend/tests/test_extract_endpoint.py` | 엔드포인트 통합 테스트 | 신규 |
| `backend/app/services/parcel_extractor.py` | 파일→`[{location,lot}]` 디스패처·정규화·파싱 | 신규 |
| `backend/app/services/openclaw_ws.py` | `vision_extract()` 추가 | 수정 |
| `backend/app/routers/ai.py` | `POST /api/ai/extract-parcels` | 수정 |
| `backend/scripts/spike_openclaw_vision.py` | Phase 0 멀티모달 스파이크 | 신규(임시) |
| `frontend/public/legacy-map/projects.js` | "+ 새 프로젝트"(빈) | 수정 |
| `frontend/public/legacy-map/editor.js` | "📄 파일에서 가져오기" 업로드·채우기 | 수정 |
| `frontend/public/legacy-map/index.html` | 두 버튼 + 숨김 input 마크업 | 수정 |
| `frontend/public/legacy-map/styles.css` | 버튼 스타일(기존 클래스 재사용) | 수정(최소) |

---

## Phase 0 — 스파이크 (OpenClaw 멀티모달 검증)

### Task 0: OpenClaw 비전 지원 스파이크

탐색 작업(TDD 아님). OpenClaw 가 이미지 content block 을 받는지, 응답 envelope 가 어떤지 1회 실측한다.

**Files:**
- Create: `backend/scripts/spike_openclaw_vision.py`

- [ ] **Step 1: 스파이크 스크립트 작성**

```python
"""Phase 0 스파이크 — OpenClaw 멀티모달(이미지) 지원 검증.
실행: python -m scripts.spike_openclaw_vision <image_path>
목적: agent.chat 에 이미지 content block 을 보냈을 때 (1) 에러 없이 응답하는지,
      (2) 응답 envelope/델타 포맷이 무엇인지 기록. 결과를 docs 에 메모.
NO API KEYS — OpenClaw LAN 게이트웨이만 사용.
"""
import asyncio, base64, json, sys, uuid
import websockets
from app.core.config import get_settings

settings = get_settings()

# 후보 A: Anthropic 스타일 content blocks
def anthropic_content(image_b64, media_type):
    return [
        {"type": "text", "text": "이 이미지에 보이는 텍스트를 한 줄로 요약해줘."},
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
    ]

# 후보 B: OpenAI 스타일 image_url
def openai_content(image_b64, media_type):
    return [
        {"type": "text", "text": "이 이미지에 보이는 텍스트를 한 줄로 요약해줘."},
        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
    ]

async def try_envelope(label, content_builder, image_b64, media_type):
    req = {
        "jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "agent.chat",
        "params": {
            "agent": settings.openclaw_agent_pet,
            "model": settings.openclaw_model_vision,
            "messages": [{"role": "user", "content": content_builder(image_b64, media_type)}],
            "stream": True,
        },
    }
    print(f"\n=== {label} ===")
    try:
        async with websockets.connect(settings.openclaw_ws_url, max_size=2**24) as ws:
            await ws.send(json.dumps(req))
            for _ in range(50):
                raw = await asyncio.wait_for(ws.recv(), timeout=30)
                evt = json.loads(raw)
                print("EVT:", json.dumps(evt, ensure_ascii=False)[:300])
                if evt.get("type") in ("done", "error") or evt.get("final"):
                    break
    except Exception as e:
        print(f"{label} FAILED: {type(e).__name__}: {e}")

async def main(path):
    media_type = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()
    await try_envelope("후보 A (anthropic)", anthropic_content, image_b64, media_type)
    await try_envelope("후보 B (openai)", openai_content, image_b64, media_type)

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
```

- [ ] **Step 2: 실행해 동작 확인**

Run: `cd backend && python -m scripts.spike_openclaw_vision ../DATA/전체지번.png`
(DATA 내 실제 지번 이미지 경로로. 없으면 임의 PNG.)
Expected: 후보 A 또는 B 중 하나가 텍스트 응답을 델타로 반환. 어느 envelope 가 동작하는지·델타 키(`type`/`text`/`delta`/`content`)를 관찰.

- [ ] **Step 3: 결과를 설계서에 기록**

`docs/superpowers/specs/2026-06-17-parcel-auto-import-design.md` 하단에 "## 부록: Phase 0 스파이크 결과" 섹션 추가 — 동작 envelope(A/B/미지원), 응답 델타 포맷, 텍스트 누적 방법을 1문단으로 기록. **이후 Task 6 은 이 결과를 따른다.**

- [ ] **Step 4: 판정 분기 기록**
  - 둘 다 실패(멀티모달 미지원) → Task 6~8(비전) 건너뛰고, editor 파일 input 의 `accept` 에서 `image/*` 제외 + 안내(Task 10 Step 참고). Phase 1·3 만 구현.
  - 하나 성공 → 그 envelope 로 Task 6 진행.

- [ ] **Step 5: 커밋**

```bash
git add backend/scripts/spike_openclaw_vision.py docs/superpowers/specs/2026-06-17-parcel-auto-import-design.md
git commit -m "spike: OpenClaw 멀티모달(이미지) 지원 검증 + envelope 기록"
```

---

## Phase 1 — 백엔드 표/텍스트PDF 추출 + 엔드포인트

### Task 1: 의존성 추가 + pytest 스캐폴드

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`

- [ ] **Step 1: requirements 에 의존성 추가**

`backend/requirements.txt` 의 `jinja2==3.1.4` 줄 아래(Reports 블록 위)에 추가:

```
# 필지 자동 입력 — 엑셀 파싱 + 테스트
openpyxl==3.1.5
pytest==8.3.4
```

- [ ] **Step 2: 설치**

Run: `cd backend && .venv/Scripts/pip install openpyxl==3.1.5 pytest==8.3.4`
Expected: 설치 성공 (이미 있으면 "already satisfied").

- [ ] **Step 3: 테스트 패키지 + conftest 작성**

`backend/tests/__init__.py` — 빈 파일.

`backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

- [ ] **Step 4: 수집 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -q`
Expected: "no tests ran" (에러 없이 수집됨).

- [ ] **Step 5: 커밋**

```bash
git add backend/requirements.txt backend/tests/__init__.py backend/tests/conftest.py
git commit -m "chore(test): pytest 스캐폴드 + openpyxl 의존성"
```

---

### Task 2: parcel_extractor — 정규화·관대 JSON 헬퍼

**Files:**
- Create: `backend/app/services/parcel_extractor.py`
- Test: `backend/tests/test_parcel_extractor.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_parcel_extractor.py`:

```python
from app.services import parcel_extractor as pe

def test_normalize_lot_strips_and_fixes_san():
    assert pe.normalize_lot("  384-18 ") == "384-18"
    assert pe.normalize_lot("산 31") == "산31"
    assert pe.normalize_lot("산31-1") == "산31-1"

def test_normalize_lot_fullwidth_digits():
    assert pe.normalize_lot("３８４－１８") == "384-18"

def test_lenient_json_strips_code_fence():
    raw = '```json\n[{"location":"상교리","lot":"385"}]\n```'
    assert pe.lenient_json(raw) == [{"location": "상교리", "lot": "385"}]

def test_lenient_json_slices_array():
    raw = '설명입니다 [{"lot":"452"}] 끝.'
    assert pe.lenient_json(raw) == [{"lot": "452"}]

def test_lenient_json_returns_none_on_garbage():
    assert pe.lenient_json("완전히 깨진 텍스트") is None
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: FAIL — `ModuleNotFoundError` 또는 `AttributeError`.

- [ ] **Step 3: 헬퍼 구현**

`backend/app/services/parcel_extractor.py`:

```python
"""업로드 파일 → 필지(동/리·지번) 목록 추출.

지목·면적 등 권위 속성은 추출하지 않는다(프론트의 VWorld 자동조회가 담당).
LLM 호출은 OpenClaw LAN 게이트웨이만 사용 — API 키 금지.
"""
from __future__ import annotations

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
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: 5 passed.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/services/parcel_extractor.py backend/tests/test_parcel_extractor.py
git commit -m "feat(extractor): 지번 정규화 + 관대 JSON 파싱 헬퍼"
```

---

### Task 3: parcel_extractor — CSV/XLSX 표 파싱

**Files:**
- Modify: `backend/app/services/parcel_extractor.py`
- Test: `backend/tests/test_parcel_extractor.py`

- [ ] **Step 1: 실패 테스트 추가**

`test_parcel_extractor.py` 하단에 추가:

```python
def test_extract_tabular_csv_maps_headers():
    csv_bytes = "동리,지번,지목\n상교리,384-18,임야\n상교리,385,전\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "상교리", "lot": "384-18"},
        {"location": "상교리", "lot": "385"},
    ]

def test_extract_tabular_csv_lot_only():
    csv_bytes = "번지\n452-1\n산29\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "", "lot": "452-1"},
        {"location": "", "lot": "산29"},
    ]

def test_extract_tabular_csv_skips_blank_lot():
    csv_bytes = "지번\n385\n\n  \n452\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert [r["lot"] for r in rows] == ["385", "452"]

def test_extract_tabular_no_lot_header_raises():
    csv_bytes = "이름,주소\n홍길동,서울\n".encode("utf-8")
    try:
        pe.extract_tabular(csv_bytes, "csv")
        assert False, "should raise"
    except pe.ExtractError:
        pass
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: FAIL — `AttributeError: extract_tabular` / `ExtractError`.

- [ ] **Step 3: 구현 추가**

`parcel_extractor.py` 상단 import 에 추가:

```python
import csv
import io
```

`parcel_extractor.py` 에 추가 (헬퍼 아래):

```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: 9 passed.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/services/parcel_extractor.py backend/tests/test_parcel_extractor.py
git commit -m "feat(extractor): CSV/XLSX 표에서 동/리·지번 추출"
```

---

### Task 4: parcel_extractor — 텍스트 PDF 추출

**Files:**
- Modify: `backend/app/services/parcel_extractor.py`
- Test: `backend/tests/test_parcel_extractor.py`

- [ ] **Step 1: 실패 테스트 추가**

```python
def test_extract_lots_from_text_finds_jibun():
    text = "1번 상교리 384-18 임야\n2번 385 전\n비고: 산31-1 포함"
    rows = pe.extract_lots_from_text(text)
    assert {"location": "", "lot": "384-18"} in rows
    assert {"location": "", "lot": "385"} in rows
    assert {"location": "", "lot": "산31-1"} in rows

def test_extract_lots_from_text_dedup():
    text = "385 385 385"
    rows = pe.extract_lots_from_text(text)
    assert [r["lot"] for r in rows] == ["385"]
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: FAIL — `AttributeError: extract_lots_from_text`.

- [ ] **Step 3: 구현 추가**

`parcel_extractor.py` 에 추가:

```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_parcel_extractor.py -q`
Expected: 11 passed.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/services/parcel_extractor.py backend/tests/test_parcel_extractor.py
git commit -m "feat(extractor): 텍스트 PDF 에서 지번 정규식 추출"
```

---

### Task 5: 엔드포인트 `POST /api/ai/extract-parcels` (표/텍스트PDF)

**Files:**
- Modify: `backend/app/routers/ai.py`
- Test: `backend/tests/test_extract_endpoint.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_extract_endpoint.py`:

```python
def test_extract_csv_returns_rows(client):
    files = {"file": ("parcels.csv", "지번\n384-18\n385\n", "text/csv")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 200
    body = r.json()
    assert [p["lot"] for p in body["parcels"]] == ["384-18", "385"]
    assert body["source"] == "tabular"

def test_extract_unsupported_type_415(client):
    files = {"file": ("a.txt", "hello", "text/plain")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 415

def test_extract_oversize_413(client):
    big = b"x" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.csv", big, "text/csv")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 413
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_extract_endpoint.py -q`
Expected: FAIL — 404 (엔드포인트 없음).

- [ ] **Step 3: 엔드포인트 구현**

`backend/app/routers/ai.py` 상단 import 교체/추가:

```python
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from pydantic import BaseModel
from ..services.openclaw_ws import stream_chat, OpenClawError
from ..services import parcel_extractor as pe
from ..core.config import get_settings
```

`ws_chat` 아래에 추가:

```python
MAX_UPLOAD = 10 * 1024 * 1024  # 10MB
_TABULAR = {".csv", ".xlsx", ".xlsm"}
_IMAGE = {".png", ".jpg", ".jpeg", ".webp"}


@router.post("/extract-parcels")
async def extract_parcels(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="파일이 너무 큼 (최대 10MB)")
    ext = os.path.splitext(file.filename or "")[1].lower()
    warnings: list[str] = []

    try:
        if ext in _TABULAR:
            rows = pe.extract_tabular(data, ext.lstrip("."))
            return {"prefix": None, "parcels": rows, "source": "tabular", "warnings": warnings}

        if ext == ".pdf":
            rows, scanned = pe.extract_text_pdf(data)
            if scanned:
                # Phase 2 에서 비전 변환; 그 전까지는 안내
                return {"prefix": None, "parcels": [], "source": "pdf",
                        "warnings": ["스캔 PDF 로 보임 — 이미지로 변환해 업로드하세요"]}
            return {"prefix": None, "parcels": rows, "source": "pdf", "warnings": warnings}

        if ext in _IMAGE:
            # Phase 2 에서 구현 (Task 7). 그 전까지는 501.
            raise HTTPException(status_code=501, detail="이미지 추출은 준비 중")

        raise HTTPException(status_code=415, detail=f"지원하지 않는 파일 형식: {ext or '알수없음'}")
    except pe.ExtractError as e:
        return {"prefix": None, "parcels": [], "source": "error", "warnings": [str(e)]}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_extract_endpoint.py -q`
Expected: 3 passed.

- [ ] **Step 5: 전체 백엔드 테스트**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -q`
Expected: 14 passed.

- [ ] **Step 6: 커밋**

```bash
git add backend/app/routers/ai.py backend/tests/test_extract_endpoint.py
git commit -m "feat(api): POST /api/ai/extract-parcels (표·텍스트PDF)"
```

---

## Phase 2 — 비전 경로 (Phase 0 스파이크 성공 시에만)

> Task 0 에서 멀티모달 미지원으로 판정됐으면 Phase 2 전체를 건너뛴다. (엔드포인트는 이미지에 501 유지, 프론트 accept 에서 image 제외 — Task 10.)

### Task 6: openclaw_ws.vision_extract()

**Files:**
- Modify: `backend/app/services/openclaw_ws.py`
- Test: `backend/tests/test_parcel_extractor.py` (mock)

> **스파이크 반영:** 아래 content 블록 형태는 Task 0 에서 **동작 확인된 envelope** 로 교체한다. (후보 A=anthropic / 후보 B=openai). 델타 누적 키도 스파이크 관찰값(`type=="delta"` & `text`)을 따른다.

- [ ] **Step 1: 구현 추가**

`backend/app/services/openclaw_ws.py` 하단에 추가:

```python
async def vision_extract(*, image_b64: str, media_type: str, prompt: str,
                         model: str | None = None) -> str:
    """이미지 1장 + 프롬프트 → 어시스턴트 전체 텍스트(비스트리밍 누적).

    content 블록 형태는 Phase 0 스파이크에서 확정된 envelope 를 사용한다.
    """
    content = [
        {"type": "text", "text": prompt},
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
    ]
    params = {
        "agent": settings.openclaw_agent_pet,
        "model": model or settings.openclaw_model_vision,
        "messages": [{"role": "user", "content": content}],
        "stream": True,
    }
    req = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "agent.chat", "params": params}
    buf: list[str] = []
    async with connect() as ws:
        await ws.send(json.dumps(req))
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=60)
            evt = json.loads(raw)
            if evt.get("type") == "delta" and evt.get("text"):
                buf.append(evt["text"])
            if evt.get("type") == "error":
                raise OpenClawError(str(evt.get("error")))
            if evt.get("type") == "done" or evt.get("final"):
                break
    return "".join(buf)
```

`settings.openclaw_model_vision` 가 config 에 있는지 확인 — 없으면 `app/core/config.py` 에 `openclaw_model_vision: str = "anthropic/claude-sonnet-4-6"` 추가.

- [ ] **Step 2: config 필드 확인**

Run: `cd backend && .venv/Scripts/python -c "from app.core.config import get_settings; print(get_settings().openclaw_model_vision)"`
Expected: `anthropic/claude-sonnet-4-6` (없으면 위처럼 추가 후 재실행).

- [ ] **Step 3: 커밋**

```bash
git add backend/app/services/openclaw_ws.py backend/app/core/config.py
git commit -m "feat(openclaw): vision_extract — 이미지 추출용 비스트리밍 호출"
```

---

### Task 7: parcel_extractor 비전 핸들러 + 엔드포인트 이미지 경로

**Files:**
- Modify: `backend/app/services/parcel_extractor.py`, `backend/app/routers/ai.py`
- Test: `backend/tests/test_parcel_extractor.py` (mock), `backend/tests/test_extract_endpoint.py` (mock)

- [ ] **Step 1: 실패 테스트 추가 (mock 비전)**

`test_parcel_extractor.py` 에 추가:

```python
import base64

def test_extract_vision_parses_json(monkeypatch):
    async def fake_vision(**kwargs):
        return '```json\n[{"location":"상교리","lot":"384 18"}]\n```'
    monkeypatch.setattr(pe, "_vision_call", fake_vision)
    rows = pe.extract_vision_sync(b"fakebytes", "image/png")
    assert rows == [{"location": "상교리", "lot": "384-18"}]
```

`test_extract_endpoint.py` 에 추가:

```python
def test_extract_image_uses_vision(client, monkeypatch):
    from app.routers import ai as ai_router
    async def fake(data, media_type):
        return [{"location": "상교리", "lot": "385"}]
    monkeypatch.setattr(ai_router.pe, "extract_vision", fake)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 32
    files = {"file": ("map.png", png, "image/png")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 200
    assert r.json()["parcels"] == [{"location": "상교리", "lot": "385"}]
    assert r.json()["source"] == "vision"
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -q -k vision or image`
Expected: FAIL — `AttributeError: extract_vision` 등.

- [ ] **Step 3: 추출기 구현 추가**

`parcel_extractor.py` 에 추가:

```python
import base64 as _b64

VISION_PROMPT = (
    "이 이미지는 한국 지적도/지번 목록/토지대장입니다. 보이는 모든 필지의 "
    "동/리 이름과 지번만 추출하세요. 지목·면적·소유자는 추출하지 마세요. "
    '오직 JSON 배열로만 답하세요: [{"location":"리이름","lot":"지번"}]. '
    "동/리를 알 수 없으면 location 은 빈 문자열. 설명·코드펜스 없이 JSON 만."
)


async def _vision_call(*, image_b64, media_type, prompt, model=None):
    from .openclaw_ws import vision_extract
    return await vision_extract(image_b64=image_b64, media_type=media_type, prompt=prompt, model=model)


async def extract_vision(data: bytes, media_type: str) -> list[dict]:
    image_b64 = _b64.b64encode(data).decode()
    text = await _vision_call(image_b64=image_b64, media_type=media_type, prompt=VISION_PROMPT)
    parsed = lenient_json(text)
    if not isinstance(parsed, list):
        return []
    out = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        lot = normalize_lot(str(item.get("lot", "")))
        if not lot:
            continue
        out.append({"location": str(item.get("location", "")).strip(), "lot": lot})
    return out


def extract_vision_sync(data: bytes, media_type: str) -> list[dict]:
    """테스트/동기 호출용 래퍼."""
    import asyncio
    return asyncio.get_event_loop().run_until_complete(extract_vision(data, media_type))
```

> `extract_vision_sync` 의 단위테스트는 `_vision_call` 을 monkeypatch 하므로 실제 WS 호출 없음.

- [ ] **Step 4: 엔드포인트 이미지 분기 교체**

`backend/app/routers/ai.py` 의 이미지 분기(`if ext in _IMAGE:` 블록)를 교체:

```python
        if ext in _IMAGE:
            media = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
            try:
                rows = await pe.extract_vision(data, media)
            except OpenClawError as e:
                raise HTTPException(status_code=502, detail=f"AI 추출 실패: {e}")
            if not rows:
                warnings.append("이미지에서 지번을 찾지 못함")
            return {"prefix": None, "parcels": rows, "source": "vision", "warnings": warnings}
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -q`
Expected: 모두 passed (16).

- [ ] **Step 6: 커밋**

```bash
git add backend/app/services/parcel_extractor.py backend/app/routers/ai.py backend/tests/
git commit -m "feat(extractor): 이미지 비전 추출 + 엔드포인트 image 경로"
```

---

### Task 8: 스캔 PDF → 이미지 변환 (graceful degrade)

**Files:**
- Modify: `backend/app/services/parcel_extractor.py`, `backend/app/routers/ai.py`

- [ ] **Step 1: 변환 가용성 헬퍼 구현**

`parcel_extractor.py` 에 추가:

```python
def pdf_first_page_png(data: bytes) -> bytes | None:
    """스캔 PDF 첫 페이지를 PNG 바이트로. pdf2image/poppler 부재 시 None."""
    try:
        from pdf2image import convert_from_bytes
    except ImportError:
        return None
    try:
        images = convert_from_bytes(data, first_page=1, last_page=1, dpi=200)
    except Exception:
        return None
    if not images:
        return None
    buf = io.BytesIO()
    images[0].save(buf, format="PNG")
    return buf.getvalue()
```

- [ ] **Step 2: 엔드포인트 스캔 PDF 분기 교체**

`ai.py` 의 `if scanned:` 블록을 교체:

```python
            if scanned:
                png = pe.pdf_first_page_png(data)
                if png is None:
                    return {"prefix": None, "parcels": [], "source": "pdf",
                            "warnings": ["스캔 PDF — 변환 도구(poppler) 없음. 이미지로 변환해 업로드하세요"]}
                try:
                    rows = await pe.extract_vision(png, "image/png")
                except OpenClawError as e:
                    raise HTTPException(status_code=502, detail=f"AI 추출 실패: {e}")
                return {"prefix": None, "parcels": rows, "source": "pdf-vision",
                        "warnings": [] if rows else ["스캔 PDF 에서 지번을 찾지 못함"]}
```

- [ ] **Step 3: 회귀 확인 (텍스트 PDF 경로 유지)**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -q`
Expected: 모두 passed (회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add backend/app/services/parcel_extractor.py backend/app/routers/ai.py
git commit -m "feat(extractor): 스캔 PDF → 첫 페이지 비전 추출 (poppler 없으면 안내)"
```

---

## Phase 3 — 프론트 (legacy-map)

### Task 9: projects.js "+ 새 프로젝트" (빈)

**Files:**
- Modify: `frontend/public/legacy-map/index.html`, `frontend/public/legacy-map/projects.js`

- [ ] **Step 1: 버튼 마크업 추가**

`index.html` 의 `projects-save-row` (42~47행) 에서 `projects-save-new` 버튼 **앞**에 추가:

```html
        <button id="projects-new-blank" class="editor-btn-secondary">+ 새 프로젝트</button>
```

- [ ] **Step 2: 빈 프로젝트 생성 함수 추가**

`projects.js` 의 `saveProject` 함수 아래에 추가:

```javascript
  function createBlankProject(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('프로젝트 이름이 비어있음');
    const all = readAll();
    if (all[clean]) throw new Error(`이미 있음: ${clean}`);
    const now = new Date().toISOString();
    all[clean] = {
      name: clean,
      parcels: [],
      prefix: window.DEFAULT_ADDRESS_PREFIX || '',
      style: null,
      createdAt: now,
      updatedAt: now,
    };
    writeAll(all);
    setActive(clean);
    // legacy 키를 빈 값으로 강제 기록 후 재로드 → 빈 표로 시작
    localStorage.setItem(PARCELS_KEY, JSON.stringify([]));
    localStorage.setItem(PREFIX_KEY, all[clean].prefix);
    localStorage.removeItem(STYLE_KEY);
    location.reload();
  }
```

- [ ] **Step 3: 이벤트 배선 추가**

`projects.js` 의 `wireEvents()` 안, `saveNewBtn` 배선 아래에 추가:

```javascript
    const newBlankBtn = document.getElementById('projects-new-blank');
    if (newBlankBtn) newBlankBtn.addEventListener('click', () => {
      const input = document.getElementById('projects-new-name');
      const name = (input.value || '').trim();
      if (!name) return alert('이름 입력 필요');
      try {
        createBlankProject(name);
      } catch (e) {
        alert(e.message);
      }
    });
```

- [ ] **Step 4: 문법 검증**

Run: `cd frontend/public/legacy-map && node --check projects.js`
Expected: 출력 없음(성공).

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/legacy-map/index.html frontend/public/legacy-map/projects.js
git commit -m "feat(legacy-map): + 새 프로젝트 (빈 프로젝트 생성·전환)"
```

---

### Task 10: editor.js "📄 파일에서 가져오기" 업로드·채우기

**Files:**
- Modify: `frontend/public/legacy-map/index.html`, `frontend/public/legacy-map/editor.js`, `frontend/public/legacy-map/styles.css`

- [ ] **Step 1: 버튼 + 숨김 input 마크업 추가**

`index.html` 의 `editor-actions` (83행~) 에서 `editor-add-row` 버튼 **앞**에 추가:

```html
        <button id="editor-file-import" class="editor-btn-primary" title="이미지·PDF·엑셀/CSV 에서 지번 자동 추출">📄 파일에서 가져오기</button>
        <input type="file" id="editor-extract-input" accept="image/*,.pdf,.xlsx,.csv" style="display:none" />
```

> Phase 0 에서 비전 미지원 판정 시: `accept` 를 `.pdf,.xlsx,.csv` 로(이미지 제외) 작성하고, 버튼 title 에 "(이미지 미지원)" 추가.

- [ ] **Step 2: 업로드 핸들러 추가**

`editor.js` 의 `fileInput` (JSON import) 핸들러 아래, `// 배경 클릭으로 닫기` 위에 추가:

```javascript
  // ===== 파일에서 지번 자동 추출 (이미지/PDF/엑셀/CSV) =====
  const extractBtn = document.getElementById('editor-file-import');
  const extractInput = document.getElementById('editor-extract-input');
  if (extractBtn && extractInput) {
    extractBtn.addEventListener('click', () => extractInput.click());
    extractInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const orig = extractBtn.textContent;
      extractBtn.disabled = true;
      extractBtn.textContent = '⏳ 추출 중...';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/ai/extract-parcels', { method: 'POST', body: fd });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const extracted = (data.parcels || []).map((p, i) => ({
          no: i + 1,
          location: p.location || '',
          lot: p.lot || '',
          category: '전',
          area_m2: 0,
          area_pyeong: 0,
          owner: '',
          memo: '',
        }));
        if (extracted.length === 0) {
          alert('지번을 찾지 못했습니다.' + (data.warnings?.length ? '\n' + data.warnings.join('\n') : ''));
          return;
        }
        // 빈 표면 교체, 기존 행 있으면 추가/교체 선택
        if (rows.length > 0) {
          const add = confirm(`기존 ${rows.length}행이 있습니다.\n확인=뒤에 추가 / 취소=교체`);
          rows = add ? rows.concat(extracted) : extracted;
        } else {
          rows = extracted;
        }
        // no 재번호
        rows.forEach((r, i) => { r.no = i + 1; });
        if (data.prefix && !prefixInput.value.trim()) prefixInput.value = data.prefix;
        render();
        const warn = data.warnings?.length ? '\n⚠ ' + data.warnings.join('\n⚠ ') : '';
        alert(`${extracted.length}개 지번 불러옴.\n지목·면적은 "🔍 전체 자동"으로 VWorld 에서 채우세요.${warn}`);
      } catch (err) {
        alert('파일 추출 실패: ' + err.message);
      } finally {
        extractBtn.disabled = false;
        extractBtn.textContent = orig;
        extractInput.value = '';
      }
    });
  }
```

- [ ] **Step 3: 스타일 (선택, 기존 클래스 재사용이라 최소)**

기존 `.editor-btn-primary` 클래스를 쓰므로 신규 스타일 불필요. 필요 시 `styles.css` 에 추가 여백만:

```css
#editor-file-import { margin-right: auto; }
```

- [ ] **Step 4: 문법 검증**

Run: `cd frontend/public/legacy-map && node --check editor.js`
Expected: 출력 없음(성공).

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/legacy-map/index.html frontend/public/legacy-map/editor.js frontend/public/legacy-map/styles.css
git commit -m "feat(legacy-map): 파일에서 지번 자동 추출 → editor 표 채우기"
```

---

## Phase 4 — 통합 검증 + 문서

### Task 11: 수동 통합 검증 + 문서 갱신

**Files:**
- Modify: `docs/work-log.md`, `docs/upgrade-log.md`

- [ ] **Step 1: 백엔드 기동 + 프론트 dev 서버**

Run: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload` (별도 터미널)
Run: `cd frontend && npm run dev`
legacy-map URL 열기 (예: `http://localhost:5173/legacy-map/index.html`).

- [ ] **Step 2: 수동 시나리오 체크 (설계서 §7)**
  - [ ] 프로젝트 모달 → "+ 새 프로젝트" → 이름 입력 → 빈 표로 전환
  - [ ] 필지 편집 → "📄 파일에서 가져오기" → CSV(지번 헤더 1열) → 지번 행 채워짐
  - [ ] (스파이크 성공 시) 이미지 업로드 → 지번 행 채워짐
  - [ ] "🔍 전체 자동" → 지목·면적 VWorld 로 채워짐 → 저장 → reload 유지
  - [ ] OpenClaw 꺼진 상태로 이미지 업로드 → "AI 추출 실패" alert, 표 유지(502)
  - [ ] .txt 업로드 → "지원하지 않는 파일" alert (415)

- [ ] **Step 3: 발견 이슈 수정** (있으면 별도 커밋)

- [ ] **Step 4: 스파이크 스크립트 정리 판단**
스파이크 결과가 설계서 부록에 기록됐으면 `backend/scripts/spike_openclaw_vision.py` 는 참고용으로 유지(임시 표식 주석 확인). 불필요하면 제거 커밋.

- [ ] **Step 5: 문서 갱신**

`docs/upgrade-log.md` 에 항목 추가: "필지 자동 입력 — 이미지/PDF/엑셀·CSV 업로드 → 동/리·지번 추출, VWorld 로 속성 권위 채움. 빈 프로젝트 생성 버튼 추가. 백엔드 `/api/ai/extract-parcels`, OpenClaw 비전(sonnet-4-6)."
`docs/work-log.md` 에 세션 요약 1줄.

- [ ] **Step 6: 커밋**

```bash
git add docs/work-log.md docs/upgrade-log.md
git commit -m "docs: 필지 자동 입력 기능 업그레이드 로그"
```

---

## 자체 점검 (작성자 체크리스트 결과)

- **Spec coverage:** 입력 3종(표=Task3, 텍스트PDF=Task4, 이미지=Task7, 스캔PDF=Task8), 추출=동/리·지번만(전 Task), 새 프로젝트=Task9, 엔드포인트=Task5, OpenClaw 비전=Task6, 에러처리(413/415/502/0건)=Task5·7, 표 채우기 정책(교체/추가 confirm)=Task10, 테스트=Task2~7, 단계(스파이크 우선)=Phase0~4. 누락 없음.
- **Placeholder scan:** 코드 단계는 모두 실제 코드 포함. 비전 envelope 만 Task0 스파이크 산출물로 확정(의도된 게이트, Task6 에 명시).
- **Type consistency:** `extract_tabular`/`extract_text_pdf`/`extract_vision`/`ExtractError`/`normalize_lot`/`lenient_json` 명칭 전 Task 일관. 엔드포인트 응답 키 `{prefix, parcels, source, warnings}` 통일. 프론트 행 스키마 `{no, location, lot, category, area_m2, area_pyeong, owner, memo}` editor.js 기존과 일치.
