# 새 프로젝트 만들기 + 파일 기반 필지 자동 입력 — 설계서

- 날짜: 2026-06-17
- 대상: `frontend/public/legacy-map/` (정적 Cesium 앱), `backend/app/`
- 관련 규칙: CLAUDE.md 2.1(OpenClaw LAN 전용, API 키 금지), 2.4(VWorld 프록시), 메모리 `legacy-map-static-validation`

## 1. 목적

프로젝트 관리 모달에 **빈 프로젝트를 새로 만드는 기능**을 추가하고, 필지 편집기에서
**이미지·PDF·엑셀/CSV 파일을 업로드하면 필지(동/리·지번) 목록을 자동 추출**해 표를
채울 수 있게 한다. 지목·면적 등 권위 속성은 기존 VWorld 자동조회를 재사용해 채운다.

## 2. 핵심 결정 (확정)

| 항목 | 결정 |
|---|---|
| 입력 파일 | 이미지(PNG/JPG), PDF(텍스트·스캔), 엑셀(xlsx)/CSV |
| 추출 대상 | **동/리 + 지번 목록만** (여러 행). 지목·면적은 추출하지 않음 |
| 속성 채우기 | 추출 후 기존 "🔍 전체 자동"(VWorld) 으로 지목·면적을 권위 조회 |
| 새 프로젝트 | 빈 프로젝트 생성 → 전환 → 업로드로 채움 |
| 추출 위치 | 백엔드 단일 엔드포인트 (`POST /api/ai/extract-parcels`) |
| 비전(이미지/스캔PDF) | OpenClaw LAN 멀티모달. **Phase 0 스파이크로 지원 검증 후 진행** |
| 표 채우기 정책 | 빈 표 → 교체. 기존 행 있으면 confirm 으로 추가/교체 선택 |
| 표 파싱 deps | `openpyxl`(xlsx) + 표준 `csv`. **pandas 미사용**(경량) |

## 3. 아키텍처

```
[legacy-map 정적 앱]                         [FastAPI 백엔드]              [OpenClaw LAN]
 editor.js                                    /api/ai/extract-parcels      ws://192.168.219.117:18789
  ├─ "📄 파일에서 가져오기" 버튼  ──업로드──▶   ├─ image/*  ─────────────▶  vision (sonnet-4-6)
  │   (이미지/PDF/xlsx/csv)                     ├─ pdf(텍스트) → pdf_extractor + 정규식/text-LLM
  │                                            ├─ pdf(스캔)  → pdf2image → vision
  │                                            └─ xlsx/csv  → openpyxl/csv (LLM 없음)
  │   ◀──{prefix, parcels:[{location,lot}]}──   (모두 동/리+지번 목록만 반환)
  ├─ 받은 행을 editor 표에 채움 (빈 표=교체 / 기존=confirm)
  └─ 기존 "🔍 전체 자동"(VWorld) → 지목·면적 권위 채움
 projects.js
  └─ "+ 새 프로젝트" 버튼 → 빈 프로젝트 생성·전환
```

## 4. 컴포넌트별 책임

### 4.1 백엔드 (신규/수정)

**`app/services/parcel_extractor.py` (신규)** — 파일 바이트 → `list[{location, lot}]` 디스패처.
- `extract(filename, content_type, data: bytes) -> ExtractResult` — 종류 판별 후 핸들러 위임.
- `_extract_tabular(data, ext)` — csv/xlsx. 헤더 휴리스틱 매핑으로 지번/동·리 컬럼 식별
  (후보 헤더: 지번·지번주소·번지·소재지·동리·리·법정동 등). 지번 컬럼만 필수, 동/리는 선택.
- `_extract_text_pdf(data)` — `pdf_extractor.extract_text` 로 텍스트 추출 → 지번 정규식
  (`산?\s?\d+(-\d+)?`) 로 후보 추출. 텍스트 비면 스캔으로 간주(빈 결과 + `scanned` 플래그).
- `_extract_vision(image_bytes, media_type)` — `openclaw_ws.vision_extract` 호출, 구조화 JSON 파싱.
- `_normalize_lot(s)` — 공백 제거, "산 31"→"산31", 전각숫자→반각.
- `_lenient_json(text)` — 코드펜스 제거 후 첫 `[`~마지막 `]` 슬라이스로 관대 파싱.
- `ExtractResult = {prefix: str|None, parcels: list[dict], source: str, warnings: list[str]}`.

**`app/services/openclaw_ws.py` (수정)** — `vision_extract(*, model, image_b64, media_type, prompt) -> str`
추가(비스트리밍). 이미지 content block envelope 는 **Phase 0 스파이크 결과로 확정**한다.
도달 불가/타임아웃 시 `OpenClawError`.

**`app/routers/ai.py` (수정)** — `POST /api/ai/extract-parcels`.
- 입력: multipart `file` (UploadFile). 크기 제한 10MB(초과 시 413).
- content_type/확장자로 라우팅. 지원 외 타입 415.
- 응답 200: `{prefix, parcels:[{location, lot}], source, warnings}`.
- OpenClaw 실패: 502 `{error, fallback: true}`.
- `/api/*` → `no-store` (기존 미들웨어).

**의존성 추가** — `openpyxl`. (텍스트 PDF 는 기존 `pypdf`. 스캔 PDF→이미지 변환 `pdf2image`+poppler
는 Phase 2 에서 가용성 확인; 불가하면 스캔 PDF 는 "이미지로 변환해 업로드" 안내로 graceful degrade.)

### 4.2 프론트 (수정, legacy-map)

**`editor.js`** — 헤더 액션에 "📄 파일에서 가져오기" 버튼 + 숨김 `<input type=file accept="image/*,.pdf,.xlsx,.csv">`.
- change 핸들러: `FormData` 로 `/api/ai/extract-parcels` POST.
- 응답 `parcels` 를 `{no, location, lot, category:'전', area_m2:0, area_pyeong:0, owner:'', memo:''}` 행으로 변환.
- 기존 `rows` 비어있으면 교체, 아니면 `confirm('기존 N행에 추가? 취소=교체')` 로 분기.
- 응답 `prefix` 있고 prefix 입력 비면 채움.
- 완료 토스트/alert: "N개 지번 불러옴 — 지목·면적은 🔍 전체 자동으로 VWorld 채우기 권장."
- 로딩/에러 상태 표시(버튼 ⏳/원복).

**`projects.js`** — "+ 새 프로젝트" 버튼 추가.
- `createBlankProject(name)`: 중복 검사 → `all[name]={name, parcels:[], prefix:DEFAULT_ADDRESS_PREFIX, style:null, createdAt, updatedAt}` → `writeAll` → `setActive` → legacy 키(parcels=[], prefix)에 기록 → `location.reload()`.
- 빈 이름/중복 시 alert.

**`index.html` / `styles.css`** — 위 버튼 마크업·스타일. 기존 토큰·버튼 클래스 재사용.

## 5. 데이터 흐름 (이미지 예시)

1. 프로젝트 모달 → "+ 새 프로젝트" → 이름 입력 → 빈 프로젝트 생성·전환(reload)
2. 필지 편집 모달 → "📄 파일에서 가져오기" → `전체지번.png` 선택
3. `POST /api/ai/extract-parcels` (multipart)
4. 백엔드: image→base64→OpenClaw 비전 + 추출 프롬프트 → `{parcels:[{location:"상교리",lot:"384-18"},...]}`
5. 프론트: 빈 표에 행 채움(지목 기본 '전', 면적 0)
6. 사용자 "🔍 전체 자동" → VWorld 가 지목·면적 권위 조회로 채움
7. 저장 → reload

## 6. 에러 처리

| 상황 | 백엔드 | 프론트 |
|---|---|---|
| OpenClaw 도달불가/타임아웃 | 502 `{error, fallback:true}` | "AI 추출 실패 — CSV/수동 입력 권장" alert, 표 유지 |
| 비전 미지원(스파이크 실패) | 이미지/스캔PDF 경로 비활성 | accept 에서 image 제외 + 안내 |
| 추출 0건 | 200 `{parcels:[], warnings:[...]}` | alert, 표 유지 |
| 깨진 JSON | 관대 파싱→실패 시 빈 결과+warning | warning 표시 |
| 지원 외 타입 | 415 | "지원 않는 파일" alert |
| 10MB 초과 | 413 | "파일이 큼" alert |
| 스캔 PDF + poppler 부재 | 200 `warnings:["이미지로 변환해 업로드"]` | 안내 alert |

## 7. 테스트

**백엔드 pytest**
- `parcel_extractor` 단위: CSV 샘플→행, xlsx→행, 헤더 매핑 변형, 텍스트 PDF 정규식, 깨진 JSON 관대 파싱, 빈 결과, 지번 정규화.
- 엔드포인트(httpx): csv 업로드→200+행, 지원 외 type→415, 초과 크기→413. OpenClaw 는 mock.
- 비전 경로 단위는 mock. 실제 호출은 Phase 0 스파이크 산출물로 envelope 1회 검증.

**프론트 (legacy-map = 정적)**
- `node --check editor.js projects.js` 문법 검증(메모리 규칙: npm build 아님).
- 수동 시나리오 체크리스트:
  - [ ] "+ 새 프로젝트" → 빈 표 전환
  - [ ] CSV 업로드 → 지번 행 채워짐
  - [ ] 이미지 업로드 → (스파이크 성공 시) 지번 행 채워짐
  - [ ] "🔍 전체 자동" → 지목·면적 채워짐
  - [ ] OpenClaw 끄고 이미지 업로드 → fallback alert, 표 유지

## 8. 단계 (스파이크 우선)

- **Phase 0 — 스파이크**: OpenClaw 에 이미지 content block 1회 전송, 멀티모달 지원·응답 envelope 확인.
  산출물: 동작 여부 + 확정된 메시지 포맷 기록(docs 또는 스파이크 스크립트). 비전 경로 진행 여부 결정.
- **Phase 1**: 백엔드 추출(csv/xlsx/텍스트PDF) + 엔드포인트 + 테스트. (LLM 불필요 경로 우선)
- **Phase 2**: 비전 경로(Phase 0 성공 시) + 스캔PDF→이미지.
- **Phase 3**: 프론트 editor 업로드 버튼 + projects "+ 새 프로젝트".
- **Phase 4**: 통합 수동 검증, work-log/upgrade-log 갱신.

## 9. 비범위 (YAGNI)

- 등기부 소유자 자동 추출(VWorld 미제공) — 추출 대상 아님.
- 좌표/폴리곤 추출 — VWorld WFS 가 담당, 추출 범위 외.
- 다국어 OCR, 손글씨 — 인쇄 지적도/대장 한정.
- 클라이언트측 xlsx 파싱(SheetJS 번들) — 백엔드 단일화로 제외.
