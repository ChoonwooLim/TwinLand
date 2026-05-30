# 작업일지

이 프로젝트의 모든 세션별 작업 내역을 날짜순으로 기록합니다.
`/end` 스킬이 세션 종료 시 자동으로 append 합니다.

---

## 2026-05-30 — VWorld 기능군 + 경사도분석 핸드오프

### 오늘 main 반영 (라이브)
- 3D 위치 검색(좌표/주소/도시명 4-tier) + 맨하탄 VWorld 건물명 오매칭 수정
- VWorld GIS 3D 건물(LT_C_SPBD 압출) + 건축물정보 팝업(건물+필지+공시지가, NED)
- 가상건물 시뮬레이션(지형 위 정확 배치, `globe.pick`)
- 도로 오버레이를 화면 범위 조회로(인접 필터 → view bounds + 패닝 재조회)
- 신규 모듈: `map-popup.js`, `vworld-buildings.js`, `virtual-building.js`

### ▶ 다음 세션 시작점 — 경사도분석
- 설계: `docs/superpowers/specs/2026-05-30-slope-analysis-design.md`
- **실행 계획: `docs/superpowers/plans/2026-05-30-slope-analysis.md`** ← 여기부터 task-by-task
- 선행조건: NGII 5m DEM 투입 — `docs/dem-ingest.md` 따라 다운로드 → `backend/data/dem/`
- DEM 미투입이어도 코드는 완성 가능(엔드포인트 503), DEM 들어오면 즉시 동작.

### 보류
- 단지용도지역 오버레이(VWorld Data API 코드 미확인, 여주엔 산단 없어 저가치)
- VWorld 3D 건물(LT_C_SPBD) 지형-기준 높이 보정(현재 해수면 0m 기준)

## 2026-05-21 — TwinLand 부트스트랩 (JooJooLand 포크)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | C:\WORK\JooJooLand 구조를 C:\WORK\TwinLand 로 클론 (tar, .git/node_modules/.venv/*.db/uploads 제외) | 완료 |
| infra | 기술 식별자 리네이밍 (joojooland → twinland): config.py, main.py 로거, .env.example, package.json, lib/api.js, AuthContext 이벤트 | 완료 |
| infra | index.html 메타·타이틀 TwinLand GIS 정체성으로 교체 | 완료 |
| docs | CLAUDE.md / README.md 전면 재작성 — GIS 목표, DATA 폴더 보고서 산출 로드맵, JooJooLand 잔재 정리 TODO 명시 | 완료 |
| infra | 상위 C:\WORK/.gitignore 에 /TwinLand/ 추가 (워크스페이스 메타리포 분리) | 완료 |
| infra | git init -b main | 완료 |
| infra | 초기 커밋 + GitHub public repo (ChoonwooLim/TwinLand) 생성 + push | 완료 |
| infra | 프로젝트 .claude/settings.local.json 에 MCP 서버 10종 config 작성 (harness 가 permissions 만 보존 → 글로벌 MCP 활용 권장) | 완료 |
| infra | backend/.venv 생성 + GIS 의존성 설치 (rasterio · geopandas · shapely · pyogrio · pyproj) + app.main 임포트 검증 | 완료 |
| infra | frontend npm install (507 packages) + `npm run build` 성공 (9.08s, 12 청크) | 완료 |

### 이번 세션 컨텍스트

- 사용자 요청: `C:\WORK\TwinLand` 를 "JooJooLand 의 토지정보 웹앱(https://joojooland.twinverse.org/map) 의 업그레이드 버전" 으로 시작.
- `DATA/` 폴더의 4가지 보고서 (필지분석결과서·산지정보조회·경사도분석·토지이용계획서) 를 자동 산출하는 GIS 가 목표.
- 샘플 부지: 여주시 북내면 상교리 384-18 (8.57ha), 산31 (4.18ha).

### 다음 세션 우선순위

1. **JooJooLand 잔재 제거** (CLAUDE.md §9 참조) — pets/dataroom/leads/upgrade 라우터 및 페이지, Pet Twinverse seed 텍스트 제거 또는 GIS 컨텐츠로 교체.
2. **i18n 재작성** — `frontend/src/i18n/{ko,en}.json` 의 JooJooLand 브랜드 문구 → TwinLand GIS 문구.
3. **보고서 산출 라우터 골격** — `/api/reports/<type>/<pnu>` 4종 (필지/산지/경사도/토지이용) 라우터 신설.
4. **PDF 산출 파이프라인** — HTML → PDF (WeasyPrint 또는 Playwright) 평가 후 결정.
5. **VWorld 콘솔에서 `twinland.twinverse.org` 도메인 재등록** + 새 API 키 발급.

## 2026-04-22

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 초기 피치 사이트 스캐폴드 (React 19 + FastAPI) | 완료 |
| feat | 지도 — VWorld/Cesium 토큰 서빙 + 인접부지 오버레이 + 5탭 GIS | 완료 |
| feat | 히어로 — three.js 우주 VFX + 다크모드 전환 (프론트 전 페이지 미러) | 완료 |
| feat | 인증 + 어드민 대시보드 설계서 + 구현 플랜 | 완료 |
| feat | 백엔드 인증 (httpOnly 쿠키 + refresh) + 14 어드민 라우터 + 신규 모델 6종 | 완료 |
| feat | Mantine v7 기반 프론트 어드민 (Login/Register/Upgrade + 14페이지) | 완료 |
| feat | 공개 DataRoom/Contact API 연동 + .env.example 정비 | 완료 |
| fix | Orbitron 빌드·캐시·쉘·yaml 다수 안정화 (22개 커밋 중 9건) | 완료 |
| fix | Postgres 기존 테이블 스키마 보정 마이그레이션 추가 + Orbitron 502 복구 | 완료 |

### 세부 내용

- 투자 피치 사이트 초기 구축: 9개 페이지 + 지도 iframe + 히어로 VFX + ko/en i18n
- 인증 스택 전면 확장: register/login/logout/refresh/forgot/reset/change-password, 4역할 권한
- 어드민 대시보드: 사용자·등업·리드·DataRoom·콘텐츠CMS·부지·AI로그·이메일·클론·스킬·플러그인·문서·운영 (14 메뉴)
- DB 변경: User/DataRoomDoc 필드 확장 + 6개 신규 테이블, `_auto_migrate()` 로 Postgres ADD COLUMN IF NOT EXISTS 자동 보정
- 이메일: Resend API 연동 + log-only fallback, Jinja2 템플릿 8종
- 배포: Orbitron 컨테이너 재기동, 스키마 수동 ALTER 8건으로 502 복구

---

## 2026-04-23

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 지도 도로 오버레이 — 지적 jibun suffix + 인접도(≤15m) 임시 교체 | 완료 |
| feat | 2D/3D 필지 스타일 컨트롤 통합, 단일색 토글, 인접 레이어 색·투명도 인라인 조정 | 완료 |
| feat | VWorld 프록시 domain 강제 (localhost 호출도 INCORRECT_KEY 회피) + dev 동시기동 | 완료 |
| feat | 3D Cesium 인접 레이어 (도로/구거/하천) classification polygon 렌더 | 완료 |
| feat | 헤더 베이스맵 빠른 전환 (VWorld/Esri/OSM/지형) + 산림 탭 + 외부 공식 조회 | 완료 |
| fix | GIS 탭바 줄바꿈 — 산림 탭 가로 스크롤 밖 숨김 이슈 | 완료 |
| feat | 맵 페이지 풀뷰포트화 (히어로 제거·풋터 숨김·내부 메뉴바 상시 노출) | 완료 |
| ui | 필지 목록을 소유자 필터 바로 아래로 이동 + 프로젝트명 동적 타이틀 | 완료 |
| feat | 📊 토지정보 모달 신설 (지목·소유자·산지·인접레이어·외부링크·리스트 7섹션) | 완료 |
| feat | 산림청 SHP 자체 적재·분석 파이프라인 (PostGIS 없이 shapely) | 완료 |
| feat | 멀티 프로젝트 SHP 적재 오케스트레이터 + BBOX 기반 프로젝트별 주입 | 완료 |
| feat | 등산로 포인트 (mountain_poi) 레이어 — 시·도별 ZIP 일괄 + 반경 3km POI 마커 | 완료 |
| feat | 도엽 단위·시군구 단위 ZIP 일괄 적재 스크립트 + 레이어 자동 판정(auto) | 완료 |
| feat | 산림입지도(soil)·임지생산능력(productivity) + 래스터(GeoTIFF zonal stats) 지원 | 완료 |
| feat | 임도(forest_road LineString)·국유림·사유림·산림기능구분도 4 레이어 추가 | 완료 |
| fix | 래스터 정체 재판정 — DATA016 = 산사태위험등급도 (경사도 아님). 색상 반전 | 완료 |
| fix | 레이어명 정정 — public_forest → private_forest (DATA022 는 사유림 경제림) | 완료 |
| infra | Docker GDAL/GEOS/PROJ 시스템 의존성 추가 + scripts/ 컨테이너 포함 | 완료 |
| docs | FGIS 배포 단위 정정 (시군구 단위 ZIP 가능) + Orbitron 실제 배포 레시피 | 완료 |

### 세부 내용

**지도 UX 전면 개편**
- 히어로 섹션 제거 후 iframe 이 뷰포트 100% 점유, `PublicShell` 에 `hideFooter/flush` 플래그 추가
- 헤더 타이틀 프로젝트명 자동 갱신, 베이스맵 5개 버튼 (위성·Esri·일반·지형·OSM)
- 필지 목록을 소유자 필터 아래로 이동, 📊 토지정보 버튼 → 큰 모달로 전체 집계

**VWorld 도메인 이슈 근본 해결**
- 원인: FGIS 서비스 URL 이 `twinverse.org` 인데 브라우저는 `joojooland.twinverse.org` 로 호출 → INCORRECT_KEY
- 백엔드 프록시가 `domain` 파라미터를 등록된 값으로 강제 덮어쓰기 (로컬/프로덕션 양쪽 작동)

**산림청 SHP 자체 적재 파이프라인 (대형)**
- PostGIS 없이 shapely 로 Python 측 교집합 계산 (DB 이미지 건드릴 일 없음)
- 레이어 9종: imsang / soil / productivity / forest_function / state_forest / private_forest / forest_road / mountain_poi / landslide_raster
- 양평 41830 시군구 단위 ZIP + 전국 등산로 11 시도 ZIP + 래스터 실측 검증 완료
- 금왕리 박스 실측: 활엽수림 60.8% / 산림휴양기능 100% / 국유림 41% 인접 / 임도 384m / 산사태 안전 33%
- API: `/api/forest/{status, analyze, analyze-batch, nearby-poi, forest-roads, landslide(-batch)}`

**Orbitron 배포 준비**
- Samba 공유 `/srv/TwinverseFolder/forest-archive` (Windows Z:) → 호스트에서 `_volumes/data/forest` 로 1.5GB 실제 복사 (symlink 는 컨테이너 해석 실패)
- Dockerfile 에 libgdal-dev/libgeos-dev/libproj-dev/libexpat1 + `scripts/` COPY 추가

### 커밋 (19 건)

- 34c7d60 fix(map): 도로 오버레이 (지적 jibun + 인접도)
- 2901c26 feat(map): 필지 스타일 2D/3D 통합 + VWorld domain 강제 + dev 동시기동
- 7c1fb53 feat(map): 3D 인접 레이어
- 7cb9705 feat(map): 헤더 베이스맵 + 산림 외부링크
- 85400a8 fix(map): GIS 탭바 줄바꿈
- c4e5a46 feat(map): 맵 페이지 풀뷰포트화
- 5740015 ui(map): 필지 목록 이동
- b304cff ui(map): 프로젝트명 동적 타이틀
- 3e8f82d feat(map): 토지정보 모달
- de506ed feat(forest): SHP 자체 적재 파이프라인
- abeed2f feat(forest): 멀티 프로젝트 오케스트레이터
- 152e293 feat(forest): 등산로 포인트
- 6db0869 feat(forest): 도엽 단위 ZIP 적재
- 7b50398 docs(forest): FGIS 배포 단위 정정
- 7db5350 fix(forest): sys.path 단일화 + classify_imsang 한글
- d05caf7 feat(forest): 산림입지·임지생산·래스터 3 종
- 6345975 feat(forest): 임도·국유림·사유림·산림기능 4 레이어
- cc7dccc fix(forest): 래스터=산사태위험 정정 + Docker GDAL
- 481ccef docs(forest): Orbitron 배포 레시피

### 추가 세션 (프로덕션 배포 디버그 · 같은 날)

Orbitron 배포 후 발생한 연쇄 이슈를 실서버 실측으로 해결:

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | rasterio lazy import — Orbitron 자체 Dockerfile 템플릿에 libexpat 없어도 앱 기동 보장 | 완료 |
| fix | geopandas==1.0.1 requirements 추가 + .prj 파싱 실패 시 EPSG:5179 fallback | 완료 |
| fix | `_auto_migrate` ALTER TABLE 테이블명 정정 — `forestfeature` → `forest_feature` (UndefinedColumn 해결) | 완료 |
| style | 토지정보 모달 라이트 테마 + 80vw (가독성·프레젠테이션 대응) | 완료 |
| infra | 프로덕션 DB 에 8 레이어 49,279 피처 최종 적재 성공 | 완료 |

**실서버 적재 결과** (`/api/forest/status`):
- imsang 23,751 / soil 20,788 / productivity 2,833 / forest_function 925
- state_forest 469 / private_forest 193 / forest_road 50 / mountain_poi 270
- **total 49,279 features · ready: true**
- landslide_raster_ready: false (Orbitron 이미지에 libexpat 부재 — 차후 과제)

**인프라 발견**: Orbitron 플랫폼은 프로젝트 `backend/Dockerfile` 을 무시하고 자체
템플릿(python:3.11 + gcc/libpq-dev)으로 빌드. 시스템 패키지 추가가 불가하므로
`rasterio` 관련 기능은 lazy-import 패턴으로 격리.

### 추가 커밋 (5 건)

- f93ac21 fix(forest): rasterio lazy import
- 4cae23c fix(forest): geopandas + CRS fallback
- 3a16946 fix(forest): ALTER TABLE 테이블명 정정
- ba85fcc style(landinfo): 라이트 테마 + 풀폭
- 0aba731 style(landinfo): 80vw + 부모 모달 특이성 오버라이드

---
