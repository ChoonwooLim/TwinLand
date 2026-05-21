# 버그 수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
| 2026-04-22 | @react-three/fiber React 19 peer 경고 | fiber v8 이 React 19 미지원 | fiber v9 + drei v10 업그레이드 | frontend/package.json |
| 2026-04-22 | Orbitron yaml JSON 파싱 에러 | 복잡한 스키마 사용 | gaongn.net 방식으로 단순화 | orbitron.yaml |
| 2026-04-22 | Orbitron 이 Orbitron.yaml 미인식 | 대문자 파일명 | orbitron.yaml 로 리네임 | orbitron.yaml |
| 2026-04-22 | Vite 8 manualChunks 형식 에러 | object 형 deprecated | function 형식으로 변경 | frontend/vite.config.js |
| 2026-04-22 | Orbitron auto-detector 가 main.py 미발견 | backend/main.py shim 부재 | backend/ 루트에 main.py shim 추가 | backend/main.py |
| 2026-04-22 | Vite 8 asset 해시가 base62 | 기존 regex 가 hex 전제 | Cache-Control 정규식을 base62 로 확장 | backend/app/main.py |
| 2026-04-22 | legacy-map 체크박스 미동작 | addEventListener 지연 부착 | 초기 로드 시 즉시 바인딩 + 0건 피드백 UI | frontend/public/legacy-map/index.html |
| 2026-04-22 | Header 가독성 저하 (투명 배경) | 스크롤 시 반투명 blur 필요 | 다크 translucent bar + 그린 accent | frontend/src/components/layout/Header.module.css |
| 2026-04-22 | Orbitron 502 Bad Gateway | PostgreSQL 기존 user 테이블에 신규 컬럼 phone/company/is_active/last_login_at 없음 | ALTER TABLE 8건 수동 적용 + `_auto_migrate()` 헬퍼 코드 추가로 재발 방지 | backend/app/main.py + Orbitron DB |
| 2026-04-23 | 지도 도로 오버레이 체크 시 INCORRECT_KEY + BBOX 전체 NED 레이트리밋 | getLandCharacteristics 를 BBOX 필지 전부에 호출 → VWorld 쿼터 초과 | 지적 jibun 한글 suffix("도") 파싱 + 인접도(꼭짓점 ≤15m) 로컬 필터, NED 호출 수십건 이하로 | frontend/public/legacy-map/app.js |
| 2026-04-23 | VWorld WFS `/req/data` 가 INCORRECT_KEY 로 즉시 거절 | 브라우저 `domain` 파라미터가 FGIS 등록 서비스 URL 호스트와 불일치 | 백엔드 프록시가 `settings.vworld_registered_domain` 값으로 강제 덮어쓰기 | backend/app/routers/vworld.py, core/config.py |
| 2026-04-23 | 2D 모드 필지 스타일 컨트롤 비활성화 | `body:not(.mode-3d) #group-parcel-style` 전체 비활성 CSS | 높이 행만 `.style-row-3d-only` 로 제한, 나머지는 2D Leaflet 에도 wiring | legacy-map/styles.css, app.js, cesium-app.js |
| 2026-04-23 | GIS 탭 6개 중 🌲 산림이 가로 스크롤 뒤 숨김 | `flex: 1 1 auto` + min-width 로 5 개까지만 | `flex-wrap: wrap` + `flex: 1 1 28%` 로 3×2 레이아웃 | legacy-map/styles.css |
| 2026-04-23 | 적재 스크립트 첫 실행 시 `no such table: forest_feature` | SQLite 에 테이블 미생성 상태에서 INSERT | `_ensure_tables()` 로 첫 호출 시 `init_db()` 자동 실행 | backend/scripts/ingest_forest_shp.py |
| 2026-04-23 | SQLAlchemy metadata 충돌 `Table already defined` | `backend.app.models.forest` 와 `app.models.forest` 두 경로로 double-load | `sys.path` 를 `backend/` 하나로 통일 + `from app.*` 일관 사용 | backend/scripts/ingest_*.py |
| 2026-04-23 | DATA016 래스터를 "경사도" 로 잘못 해석 | 값이 1~5 등급이라 경사도로 오인, 실제는 산사태위험등급도 | analyze_slope_raster → analyze_landslide_raster, 등급 라벨·색상 반전(1=높음 빨강~5=낮음 초록) | services/forest_raster.py, routers/forest.py, landinfo.js |
| 2026-04-23 | DATA022 레이어명 오류 | 실제는 "경제림육성단지 사유림", 초기엔 공유림으로 추정 | `public_forest` → `private_forest` (옛 이름은 choices 에 호환 유지) | services/forest_gis.py, scripts/ingest_*.py |
| 2026-04-23 | Orbitron 컨테이너 기동 실패 `libexpat.so.1` | `python:3.12-slim` 에 GDAL/PROJ/GEOS/expat 시스템 의존성 없음 | Dockerfile 에 `libexpat1 libgdal-dev libgeos-dev libproj-dev` + `scripts/` COPY | backend/Dockerfile |
| 2026-04-23 | Orbitron 자체 Dockerfile 템플릿 사용으로 위 GDAL 추가 무효 → 여전히 libexpat 에러 | Orbitron 플랫폼이 프로젝트 `backend/Dockerfile` 을 무시하고 python:3.11 + gcc/libpq-dev 표준 이미지로 빌드 | rasterio import 를 모듈 상단 → 함수 내부 lazy import 로 이동. 앱 기동은 성공, 래스터 API 만 ImportError 시 error dict 반환 | backend/app/services/forest_raster.py |
| 2026-04-23 | 프로덕션 적재 `pyogrio 읽기 실패: geopandas is required` | pyogrio 0.10.0 이 `read_dataframe()` 에서 geopandas 의존 | requirements.txt 에 `geopandas==1.0.1` 추가 | backend/requirements.txt |
| 2026-04-23 | 프로덕션 적재 `column "geom_type" of relation "forest_feature" does not exist` | `_auto_migrate` 의 ALTER TABLE 문이 테이블명을 `forestfeature` (underscore 없음) 로 썼는데 실제 SQLModel `__tablename__='forest_feature'` | ALTER TABLE 대상 `forestfeature` → `forest_feature` 수정 | backend/app/main.py |
| 2026-04-23 | 토지정보 모달 폭이 500px 로 제한됨 (설정은 98vw) | 상위 `.modal-content{max-width:500px}` 가 동일 특이성 뒤 선언으로 오버라이드 | `.modal-content.landinfo-modal-content` 로 특이성 2→3 상승 + 폭 80vw 확정 | frontend/public/legacy-map/styles.css |
