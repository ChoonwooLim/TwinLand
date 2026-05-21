# TwinLand — Claude 작업 가이드

`C:\WORK\TwinLand\` — 한국 지리정보 시스템(GIS) 웹앱.
전역 규칙은 `~/.claude/CLAUDE.md` + `C:\WORK\infra-docs\ai-shared-registry.md` 를 그대로 따른다.

---

## 1. 프로젝트 맥락

- **목적**: `C:\WORK\TwinLand\DATA` 의 모든 보고서 — **필지분석결과서, 산지정보조회, 경사도분석, 토지이용계획서** — 를 웹에서 자동 산출하는 GIS 플랫폼.
- **계보**: `C:\WORK\JooJooLand` (https://joojooland.twinverse.org/map) 의 GIS 코어를 클론해 출발 → 보고서 산출 / 3D 시각화 / 시그너처 UX 로 업그레이드. JooJooLand 의 펫 테마파크 컨텐츠는 점진적으로 제거 또는 GIS-맥락으로 재작성.
- **스택**: React 19 + Vite 8 + Mantine + react-leaflet + Cesium / FastAPI + SQLModel / PostgreSQL (Orbitron) + 산림청 SHP / VWorld OpenAPI / OpenClaw LAN.
- **현재 데이터 범위**: 양평·여주 (`PROJECT_BBOX=127.50,37.30,127.85,37.60`) — 샘플은 여주시 북내면 상교리 필지.

## 2. 절대 원칙

### 2.1 AI는 OpenClaw LAN 경로만 (API 키 금지)
- 모든 LLM 호출 → `ws://192.168.219.117:18789` OpenClaw 게이트웨이
- `.env` 에 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 절대 등록 금지
- 이유: ChatGPT Plus + Claude Code CLI 플랜 토큰으로 과금 0원 운영

### 2.2 캐시 헤더 (전역 CLAUDE.md 규칙)
- HTML / `/api/*` 이외 → `public, max-age=0, must-revalidate`
- `/assets/*-{hash}.*` → `public, max-age=31536000, immutable`
- `/api/*` → `no-store`
- 구현: `backend/app/main.py` 미들웨어 + `frontend/vite.config.js`

### 2.3 비밀값
- 모든 시크릿은 Orbitron secrets 에만 저장
- `.env.example` 에는 키 이름만, 값은 빈 문자열
- Git 에 `.env` 커밋 금지

### 2.4 VWorld 프록시 패턴
- 브라우저가 VWorld API 를 직접 호출하면 INCORRECT_KEY 발생 (등록 도메인 검증 때문)
- 반드시 `/api/vworld/*` 백엔드 프록시 경유, `domain` 파라미터는 `VWORLD_REGISTERED_DOMAIN` 으로 강제 치환

## 3. 코딩 컨벤션

### 3.1 Frontend
- React 19 함수형 컴포넌트 + 훅
- CSS Modules (글로벌 토큰은 `src/styles/tokens.css`)
- UI 라이브러리: Mantine v9 (charts·forms·modals 모두 포함)
- 번역은 `react-i18next` — 하드코딩 문자열 금지, `t('key')` 사용
- 3D/스트리밍 컴포넌트는 `lazy` + `Suspense` 로 코드 스플릿
- 지도 스택: 2D = react-leaflet, 3D = Cesium (resium), 3D 모델 = react-three-fiber

### 3.2 Backend
- 라우터는 `app/routers/*.py`, prefix 는 `main.py` 에서 일괄 등록
- 모델은 `app/models/*.py` SQLModel
- 공간 데이터: PostGIS + GeoAlchemy2 (운영) / shapely+pyogrio (스크립트)
- 산림청 SHP 적재: `backend/scripts/forest_ingest.py` (상세: `docs/forest-shp-ingest.md`)
- 산사태위험 래스터 zonal stats: rasterio
- 모든 엔드포인트는 `/api/*` prefix

### 3.3 테스트
- 프론트: Vitest + RTL + Playwright
- 백엔드: pytest + httpx + testcontainers-postgres

## 4. 보고서 산출 기능 (TwinLand 목표)

`DATA/` 의 각 보고서 유형이 곧 빌드 대상이다. 우선순위는 다음과 같이 시작한다 (변동 가능):

| 보고서 | 산출 데이터 | 의존 |
|---|---|---|
| 필지분석결과서 | VWorld 필지 + 산림청 SHP + 산사태위험 zonal stats | 모두 (기존 `parcels` 라우터 확장) |
| 산지정보조회 | 산림청 임상도 + 산지 구분도 | `forest` 라우터 |
| 경사도분석 | DEM 래스터 → slope 분석 | rasterio + 새 `terrain` 라우터 |
| 토지이용계획 | VWorld 토지이용계획도 + 공시지가 | 새 `landuse` 라우터 |

신규 보고서를 추가할 때:
1. SHP/래스터 입력 명세 → `docs/forest-shp-ingest.md` 또는 새 인제스트 문서에 기록
2. 백엔드 라우터 신설 (`/api/reports/<type>`)
3. 프론트 페이지: `/reports/<type>/<parcel_pnu>`
4. PDF 출력: WeasyPrint 또는 Playwright 로 HTML→PDF 렌더

## 5. i18n

- 기본 언어: 한국어 (ko)
- 지원: ko, en
- 파일: `frontend/src/i18n/ko.json`, `en.json`

## 6. Wiki / 지식 참조

- LLM/AI 관련 질문 → `C:\WORK\llm-wiki\` 먼저 참조
- 값(env/키/포트)은 `C:\WORK\infra-docs\ai-shared-registry.md` SSOT

## 7. 배포

- Backend: Orbitron + Cloudflare Tunnel
- 공개 URL: `twinland.twinverse.org` (예정)
- VWorld 콘솔 등록 도메인: `twinland.twinverse.org` (브라우저 직접호출 차단, 백엔드 프록시로 통일)
- Orbitron 명세: `orbitron.yaml`

## 8. 폴더 구조 (요약)

```
TwinLand/
├── frontend/        React 19 + Vite + Mantine + Cesium + react-leaflet
├── backend/         FastAPI + SQLModel + PostGIS
├── docs/            설계·진척·SHP 인제스트 가이드
├── DATA/            샘플 보고서 (목표 산출물 레퍼런스)
├── .claude/         스킬·설정
├── orbitron.yaml    배포 명세
└── CLAUDE.md        (이 파일)
```

## 9. JooJooLand 잔재 정리 TODO

JooJooLand 클론 직후 단계 — 다음은 GIS 본연의 목표와 무관하므로 점진적으로 정리:

- `backend/app/routers/pets.py`, `dataroom.py`, `leads.py`, `upgrade.py` → 제거 또는 보고서 워크플로우로 재사용
- `backend/app/main.py` 의 `SEED_BLOCKS` (Pet Twinverse pitch 텍스트) → TwinLand 홈/About 컨텐츠로 교체
- `frontend/src/pages/DigitalClone.jsx`, `ThemePark.jsx`, `Investment.jsx`, `Vision.jsx`, `Demo.jsx`, `DataRoom.jsx` → 제거 또는 GIS 페이지로 교체
- `frontend/src/components/{clone,hero,demo}/` → 제거 또는 보고서 UI 로 교체
- `frontend/src/i18n/{ko,en}.json` 의 JooJooLand/Pet Twinverse 문구 → TwinLand GIS 문구로 재작성
- 이메일 템플릿 (`backend/app/templates/email/*.html`) — JooJooLand 브랜드 → TwinLand 브랜드
- legacy-map (`frontend/public/legacy-map/`) — 가치 평가 후 통합 또는 제거
- VWorld 등록 도메인 갱신 (`twinland.twinverse.org` 로 콘솔에서 재발급 필요)

## 10. 변경시 주의

- 새 GIS 데이터셋(래스터/SHP)을 추가할 땐 `docs/` 에 인제스트 명세 먼저 작성
- 아키텍처 크게 바꿀 땐 `brainstorming` → `writing-plans` 스킬 절차 재실행
- 커밋 메시지는 한국어 OK, 이모지 자제
