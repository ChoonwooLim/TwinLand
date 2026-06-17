# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|---------|----------|
| 2026-04-22 | 초기 JooJooLand 투자 피치 사이트 스캐폴드 (React 19 + FastAPI + PostgreSQL) | 초기화 | frontend/ backend/ orbitron.yaml |
| 2026-04-22 | VWorld API 키를 백엔드 /api/vworld/config.js 로 서빙 | 보안/프론트 | backend/app/routers/vworld.py |
| 2026-04-22 | Cesium Ion Token 추가 + 3D 지도 대응 | 지도 | backend/app/routers/vworld.py |
| 2026-04-22 | 지도 NAV 라벨 "지도" → "사업예정부지" | UI/카피 | frontend/src/components/layout/Header.jsx, i18n/*.json |
| 2026-04-22 | 인접부지 오버레이 5종 토글 (도로/구거/하천/공공/군사) + NED getLandCharacteristics 재구성 + 전면 캐시 | 지도/성능 | frontend/public/legacy-map/ backend/app/routers/vworld.py |
| 2026-04-22 | 히어로 three.js "살아있는 우주" VFX (별 3500개 + 네뷸라 + 유성) | 시네마틱/3D | frontend/src/components/hero/CosmicVFX.jsx |
| 2026-04-22 | 프론트 전 페이지 다크모드 전환 + legacy-map GIS 5탭/다크모드 미러 | 테마/디자인 | frontend/src/styles/ + legacy-map |
| 2026-04-22 | 인증 + 어드민 대시보드 설계서 작성 (v1, 577줄) | 문서/설계 | docs/superpowers/specs/ |
| 2026-04-22 | 인증 + 어드민 구현 플랜 P1~P10 | 문서/설계 | docs/superpowers/plans/ |
| 2026-04-22 | 백엔드 인증 확장: httpOnly 쿠키 + refresh token (15m/30d) + 4역할 권한 + register/logout/refresh/forgot/reset/change | 인증/백엔드 | backend/app/core/security.py deps.py routers/auth.py |
| 2026-04-22 | 신규 DB 모델 6종 (UpgradeRequest/ContactLead/ContentBlock/AIChatLog/EmailLog/DownloadLog) + User·DataRoomDoc 필드 확장 | DB/모델 | backend/app/models/ |
| 2026-04-22 | 어드민 라우터 허브 + 11개 feature 서브 (dashboard/users/content/parcels/ai-logs/emails/clones/skills/plugins/docs/ops) | 어드민/백엔드 | backend/app/routers/admin/ |
| 2026-04-22 | upgrade/leads/dataroom 라우터 신설 — 등업 요청·리드 파이프라인 7단계·파일 업로드/인증 게이트 다운로드+로그 | 업무 로직 | backend/app/routers/ |
| 2026-04-22 | Resend 기반 이메일 서비스 + log-only fallback (Jinja2 템플릿 8종) | 이메일 | backend/app/services/email.py templates/ |
| 2026-04-22 | 초기 superadmin 시드 + ContentBlock 28개 시드 (home/investment slots) | 부트스트랩 | backend/app/main.py |
| 2026-04-22 | Mantine v7 도입 (core/hooks/form/notifications/modals/dropzone/charts) + @tabler/icons + react-markdown | 프론트 스택 | frontend/package.json frontend/src/main.jsx |
| 2026-04-22 | AuthContext + ProtectedRoute + axios 401 자동 refresh 인터셉터 | 인증/프론트 | frontend/src/features/auth/ lib/api.js |
| 2026-04-22 | 인증 페이지 5종 (Login/Register/ForgotPassword/ResetPassword/Upgrade) | 인증/UI | frontend/src/pages/ |
| 2026-04-22 | AdminLayout (AppShell 14메뉴 사이드바 + 등업 대기 배지 폴링) | 어드민/UI | frontend/src/features/admin/ |
| 2026-04-22 | 어드민 페이지 14종 (Dashboard/Users/Upgrades/Leads/DataRoom/Content/Parcels/AILogs/Emails/Clones/Skills/Plugins/Docs/Ops) | 어드민/UI | frontend/src/pages/admin/ |
| 2026-04-22 | Header 로그인 상태 드롭다운 (어드민/등업/DataRoom 바로가기) + 로그인 CTA | UI/네비 | frontend/src/components/layout/Header.jsx .module.css |
| 2026-04-22 | 공개 DataRoom 페이지 API 연동 (투자자 게이트 + 다운로드) + Contact 폼 리드 제출 | 공개 페이지 | frontend/src/pages/DataRoom.jsx Contact.jsx |
| 2026-04-22 | Postgres 자동 컬럼 보정 `_auto_migrate()` — ADD COLUMN IF NOT EXISTS 8건 자동화 | 인프라/DB | backend/app/main.py |
| 2026-04-23 | 2D/3D 필지 스타일 컨트롤 통합 (색·투명도·외곽선·면채우기) + 대상 34필지 단일색 토글 | 지도/UX | legacy-map/styles.css, app.js, cesium-app.js, index.html |
| 2026-04-23 | 인접 레이어 (도로/구거/하천/국공/군) 인라인 색·투명도 슬라이더 + 범례 동기화 | 지도/UX | legacy-map/app.js, index.html |
| 2026-04-23 | 3D Cesium 에서도 인접 레이어 classification polygon 으로 렌더 (지형 드레이프) | 지도/3D | legacy-map/cesium-app.js, app.js |
| 2026-04-23 | 헤더 베이스맵 빠른 전환 5개 버튼 (VWorld 위성·Esri·일반·지형·OSM) + 사이드바 정리 | 지도/UI | legacy-map/index.html, styles.css, app.js |
| 2026-04-23 | GIS 오버레이에 🌲 산림 탭 신설 — 임상·산림입지·산지구분·산사태·자연환경보전 후보 + 외부 공식 조회 카드 3종 (다드림·FGIS·산지정보) | 지도/UX | legacy-map/index.html |
| 2026-04-23 | 맵 페이지 풀뷰포트화 — 히어로 제거·풋터 숨김(flush mode)·내부 헤더 상시 노출 | UX/레이아웃 | frontend/src/pages/Map.{jsx,module.css}, App.jsx, styles/global.css |
| 2026-04-23 | 내부 맵 헤더 타이틀을 활성 프로젝트명 + 사업예정부지 로 동적 표시 | UI/카피 | legacy-map/index.html, projects.js, styles.css |
| 2026-04-23 | 📊 토지정보 모달 신설 — 총괄/지목/소유자/산지/인접/외부링크/필지리스트 7섹션 | 리포트/UX | legacy-map/landinfo.js, index.html, styles.css |
| 2026-04-23 | VWorld 프록시가 `domain` 파라미터를 설정값으로 덮어써 INCORRECT_KEY 회피 | 인프라/백엔드 | backend/app/routers/vworld.py, core/config.py |
| 2026-04-23 | `npm run dev` 가 프론트+백엔드 동시 기동 (concurrently) | DX | frontend/package.json |
| 2026-04-23 | 산림청 SHP 자체 적재·분석 파이프라인 (PostGIS 없이 shapely Python 측 계산) | 인프라/GIS | backend/app/models/forest.py, services/forest_gis.py, routers/forest.py, scripts/ingest_forest_*.py |
| 2026-04-23 | 레이어 9종: imsang/soil/productivity/forest_function/state_forest/private_forest/forest_road(LineString)/mountain_poi(Point)/landslide_raster(GeoTIFF) | GIS/도메인 | services/forest_gis.py, forest_raster.py |
| 2026-04-23 | 멀티 프로젝트 오케스트레이터 — 전국/시군구/도엽 ZIP 일괄 자동 판정 적재 | GIS/운영 | backend/scripts/ingest_forest_{all,sheets,mountain_poi}.py |
| 2026-04-23 | 산사태위험등급 래스터 zonal stats API + 프론트 모달 차트 (안전 구간 % 강조) | GIS/분석 | backend/app/services/forest_raster.py, routers/forest.py, landinfo.js |
| 2026-04-23 | 임도 최근접 거리·교차 여부 API + 프론트 섹션 | GIS/분석 | services/forest_gis.py, routers/forest.py, landinfo.js |
| 2026-04-23 | Docker 이미지에 GDAL/GEOS/PROJ/libexpat + scripts/ 포함 → rasterio/pyogrio 런타임 보장 | 인프라/Docker | backend/Dockerfile |
| 2026-05-21 | TwinLand 부트스트랩: JooJooLand 포크 → GIS 정체성 리네이밍 (config·env·package·api·index.html) + CLAUDE.md/README 재작성 + GitHub repo (ChoonwooLim/TwinLand) 생성 + DATA/ 샘플 보고서 4종×2필지 트래킹 | 초기화/리브랜딩 | 전체 (commit 74eb884) |
| 2026-05-30 | 3D 위치 검색 — 좌표/주소/도시명 4단계 지오코딩(parseLatLng→VWorld→Cesium Ion→OSM) + 위경도 직접입력 셀 | 지도/3D | legacy-map/cesium-app.js, index.html |
| 2026-05-30 | VWorld GIS 3D 건물(LT_C_SPBD 압출) 토글 + 건물 클릭 시 건물·필지·토지특성(공시지가/지목) 통합 팝업 + 재사용 MapPopup | 지도/3D/리포트 | legacy-map/vworld-buildings.js, map-popup.js, index.html |
| 2026-05-30 | 가상건물 시뮬레이션 — 폴리곤 그려 층수·층고·투명도·건물명 설정→입체 압출(지형 위 배치)·localStorage 저장 | 지도/시뮬 | legacy-map/virtual-building.js, index.html |
| 2026-06-17 | 빈 프로젝트 생성('+ 새 프로젝트') + 파일에서 지번 자동 추출('📄 파일에서 가져오기') — 이미지/PDF/엑셀·CSV 업로드 → 동/리·지번 행 채움, 지목·면적은 기존 VWorld 자동조회로 보정 | 리포트/입력 | legacy-map/projects.js, editor.js, index.html |
| 2026-06-17 | 백엔드 추출 엔드포인트 `POST /api/ai/extract-parcels` — CSV/XLSX(openpyxl)·텍스트PDF(pypdf 정규식)·이미지(Ollama 비전) 분기, 동/리·지번만 반환 | 백엔드/API | backend/app/routers/ai.py, services/parcel_extractor.py |
| 2026-06-17 | 이미지 스캔 비전 = twinverse-ai LAN Ollama(gemma4:26b) 직호출(다운스케일 Pillow). OpenClaw 게이트웨이는 원격 비전 미지원이라 우회 | AI/GIS | backend/app/services/ollama_vision.py |
| 2026-06-17 | OpenClaw v3 클라이언트 정정 포팅(Ed25519 핸드셰이크, 포트 18790) — 기존 미작동 openclaw_ws.py(jsonrpc) 대체, 텍스트 추론·device 페어링 | 인프라/AI | backend/app/services/openclaw_v3.py |
| 2026-06-17 | ✨ 새 프로젝트 통합 모달 — 헤더 버튼 → 이름+파일 드래그·업로드 → 추출 미리보기 → 빈/채움 생성·전환 | 리포트/UX | legacy-map/newproject.js, projects.js, index.html, styles.css |
| 2026-06-17 | 추출 확장 — 지번뿐 아니라 문서의 지목·면적·소유자도 함께 추출(비전 프롬프트·tabular 컬럼 매핑·면적 파서) | 리포트/AI | backend/app/services/{ollama_vision,parcel_extractor}.py, legacy-map/{newproject,editor}.js |
| 2026-06-17 | VWorld '🔍 전체 자동' 확장 — 공시지가·용도지역·토지이용 전용 컬럼 + NED getLandCharacteristics 연동 | GIS/리포트 | frontend/public/legacy-map/editor.js, index.html |
