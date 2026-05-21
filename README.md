# TwinLand — 한국 지리정보 시스템(GIS)

> **"필지 하나면 모든 보고서가 나온다."**

VWorld 오픈API + 산림청 SHP + Cesium 3D 위성 + 산사태위험 래스터 zonal stats 를 한 화면에 모아,
**필지분석결과서 / 산지정보조회 / 경사도분석 / 토지이용계획서** 를 자동 산출하는 차세대 GIS 플랫폼.

기반: [JooJooLand 토지정보 웹앱](https://joojooland.twinverse.org/map) 의 GIS 코어를 클론·확장.
샘플 산출물은 `DATA/` 폴더 (여주시 북내면 상교리 필지 기준).

## 스택

- **Frontend**: React 19 + Vite 8 + Mantine v9 + react-leaflet + Cesium(resium) + react-three-fiber + react-i18next + framer-motion
- **Backend**: FastAPI + SQLModel + PostgreSQL (+ PostGIS) + JWT
- **공간 데이터**: VWorld 오픈API · 산림청 SHP (임상도/산지구분도/산사태위험) · DEM 래스터
- **AI**: OpenClaw LAN Gateway (CLI plan-token 전용, API 키 無)
- **PDF 산출**: HTML → PDF (WeasyPrint / Playwright)

## 시작

```bash
# Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env   # 값 채우기 (VWORLD_API_KEY / CESIUM_ION_TOKEN)
python -m uvicorn app.main:app --reload --port 8000

# Frontend (다른 터미널)
cd frontend
npm install
npm run dev   # 5173
```

통합 dev (concurrently): `cd frontend && npm run dev:all`

## 보고서 산출 목표 (DATA/ 폴더 참고)

| 보고서 | 입력 데이터 | 상태 |
|---|---|---|
| 필지분석결과서 | VWorld 필지 + 산림청 + zonal stats | 코어 이식 완료, PDF 산출 작업 예정 |
| 산지정보조회 | 산림청 임상도 + 산지구분도 | 임상도 적재 완료 |
| 경사도분석 | DEM → slope/aspect | 래스터 파이프라인 작업 예정 |
| 토지이용계획서 | VWorld 토지이용계획도 + 공시지가 | 라우터 신설 예정 |

## 문서

- 작업 가이드: [CLAUDE.md](CLAUDE.md)
- 개발 계획: [docs/dev-plan.md](docs/dev-plan.md)
- 산림청 SHP 적재 가이드: [docs/forest-shp-ingest.md](docs/forest-shp-ingest.md)
- AI 인프라 레지스트리: `C:\WORK\infra-docs\ai-shared-registry.md`

## 라이선스

All Rights Reserved — TwinLand (2026)
