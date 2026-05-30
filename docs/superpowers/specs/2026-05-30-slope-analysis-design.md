# 경사도분석 — 설계서

- **날짜**: 2026-05-30
- **상태**: 승인됨 (구현 대기 — DEM 파일 투입 대기)
- **범위**: 백엔드 `terrain` 서비스/라우터 + 프론트 필지 클릭 표시 + 기존 경사도 WMS 오버레이 검증
- **핸드오프**: 내일 새 세션에서 [구현 계획](../plans/2026-05-30-slope-analysis.md) 실행. DEM은 [dem-ingest](../../dem-ingest.md) 따라 투입.

---

## 1. 배경 / 목표

`DATA/` 의 **경사도분석** 보고서가 산출 목표(CLAUDE.md §4). 필지별 경사도(평균/최대/경사구간별 면적)를 산출·표시한다. VWorld dtkmap 의 경사도 분석은 그들의 3D 분석 도구라 외부 이식 불가 → TwinLand 자체 산출.

## 2. 핵심 결정 (사용자 승인)

- **DEM 출처 = NGII 5m 수치표고모델** (정확도 우선, VWorld급). 산림 SHP 처럼 **수동 수급 + 인제스트**. 코드는 미리 완성, DEM 파일 투입 시 즉시 동작.
- **경사 단위 = 도(°)**.
- **경사 계산 = numpy gradient** (gdaldem 바이너리 불필요 — `forest_raster.py` 와 동일하게 rasterio+numpy 만).
- **색 오버레이 = 기존 VWorld 경사도 WMS** (`lt_c_damden`, `⛰ 환경` 탭 "경사도(β)" 토글). 자체 경사 타일 렌더는 v1 제외.
- **경사 등급 4구간**: 완경사 0–10° / 경사지 10–20° / 급경사 20–30° / 험준지 >30°.

## 3. 아키텍처 (기존 패턴 재사용)

### 3.1 DEM 인제스트 (문서: `docs/dem-ingest.md`)
국토정보플랫폼에서 양평·여주 5m DEM 다운로드 → `backend/data/dem/` 배치. 환경변수 `DEM_DIR` 로 경로 관리(산림 래스터와 동일 방식).

### 3.2 백엔드 `app/services/terrain.py` + `app/routers/terrain.py`
- `forest_raster.py` 의 `analyze_landslide_raster` 패턴 그대로:
  - 필지 geom(EPSG:4326) → DEM CRS(예 EPSG:5186) 재투영 (pyproj Transformer).
  - `rasterio.mask` 로 필지 영역 DEM 잘라내기.
  - `numpy.gradient` (픽셀 간격 m 반영) → 경사도(°) 배열.
  - 집계: 평균·최대·최소 + 등급별 픽셀수→면적(픽셀면적 ㎡ 곱).
- 라우터: `GET /api/terrain/slope?pnu=...` (또는 geom POST). DEM 미설정 → `503 {"detail":"DEM not configured"}`.
- 응답 예:
  ```json
  {"pnu":"...","avg_deg":11.8,"max_deg":27.6,"min_deg":2.1,
   "classes":[{"label":"완경사(0-10°)","area_m2":120,"ratio":0.10}, ...]}
  ```

### 3.3 프론트
- (a) **색 오버레이**: 기존 "경사도(β)" WMS 토글 — 렌더 검증, 되면 (β) 제거.
- (b) **필지 클릭 → 경사 정보**: 2D 필지 클릭 팝업(app.js) 또는 3D 건축물 팝업에 경사 행 추가 — `/api/terrain/slope?pnu=` 호출 → "평균 12° · 최대 28° · 급경사(>20°) 340㎡(28%)" + 등급 색.

## 4. 데이터 흐름

```
필지 클릭 → PNU → GET /api/terrain/slope?pnu=
  → DEM 로드 → 필지 재투영 → mask → numpy gradient(경사°) → 등급 집계
  → {avg,max,classes[]} → 팝업 표시
```

## 5. 검증 / 배포

- DEM 미투입: 엔드포인트 503, (a) 색 오버레이만 동작.
- DEM 투입: 즉시 (b) 동작. 검증 = 상교리 샘플 필지(384-18 등) 경사값이 위성영상 지형과 합치하는지.
- 백엔드 테스트: `forest_raster` 테스트 패턴(필지 geom + 소형 DEM fixture) 재사용.

## 6. 리스크

- **DEM CRS/포맷 다양** (.img/.tif, EPSG:5186/5179) — 인제스트 문서에서 메타 확인 + 코드에서 `dataset.crs` 동적 사용.
- **5m DEM 용량** — 양평·여주만 한정 수급. 파일시스템 보관(DB 부적합), 산림 래스터와 동일.
- **소형 필지** — 5m면 수~수십 픽셀 확보되어 충분(30m였으면 부족).

## 7. 단계 (내일 세션)

1. `docs/dem-ingest.md` 보고 DEM 다운로드·배치 (사용자).
2. 백엔드 `terrain` 서비스/라우터 (계획 Task 1–3).
3. 프론트 필지 클릭 경사 표시 + WMS 오버레이 검증 (계획 Task 4–5).
