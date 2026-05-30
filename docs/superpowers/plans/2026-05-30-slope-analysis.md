# 경사도분석 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (또는 subagent-driven-development). Steps use `- [ ]`.
> **핸드오프(내일 새 세션 시작점):** 이 계획을 위에서부터 실행한다. **선행조건**: [docs/dem-ingest.md](../../dem-ingest.md) 따라 NGII 5m DEM 을 `backend/data/dem/` 에 투입(사용자). DEM 없이도 코드는 완성되며 엔드포인트가 503 반환 → DEM 투입 시 즉시 동작.

**Goal:** NGII 5m DEM 으로 필지별 경사도(평균/최대/경사구간 면적)를 산출하는 백엔드 + 필지 클릭 시 표시하는 프론트 + 기존 경사도 WMS 색 오버레이 검증.

**Architecture:** `forest_raster.py`(rasterio zonal-stats)·산림 SHP 인제스트 패턴 재사용. 백엔드 `terrain` 서비스가 필지 폴리곤×DEM 으로 numpy gradient 경사 계산. 프론트는 필지 geometry 를 POST.

**Tech Stack:** FastAPI, rasterio(+GDAL, lazy import), numpy, pyproj, shapely. 프론트 vanilla JS(Leaflet).

---

## 사전 메모 (실행 전 필독)
- [설계서](../specs/2026-05-30-slope-analysis-design.md), [DEM 인제스트](../../dem-ingest.md).
- **참고 패턴**: `backend/app/services/forest_raster.py`(lazy import + pyproj 재투영 + rasterio.mask), `backend/app/routers/*.py`(라우터 등록은 `backend/app/main.py`), `frontend/public/legacy-map/app.js`(필지 클릭 팝업).
- 경사 단위 °, numpy gradient, 4등급(완경사 0–10 / 경사지 10–20 / 급경사 20–30 / 험준지 >30).
- 백엔드 테스트: pytest. 단 DEM fixture 없으면 503 경로만 테스트.

---

## Task 1: 설정 — DEM_DIR

**Files:** Modify `backend/app/core/config.py`

- [ ] **Step 1:** `Settings` 에 추가:
```python
    dem_dir: str = "backend/data/dem"
```
- [ ] **Step 2:** `.env.example` 에 `DEM_DIR=` 추가(값 빈 문자열, 키만).
- [ ] **Step 3:** 커밋 `chore(terrain): DEM_DIR 설정 추가`

---

## Task 2: 백엔드 경사 서비스

**Files:** Create `backend/app/services/terrain.py`

- [ ] **Step 1:** 파일 생성(아래 전체). `forest_raster.py` 의 lazy-import·재투영 패턴과 동일.

```python
"""DEM(수치표고모델) 기반 필지 경사도 분석. forest_raster 패턴 재사용."""
from __future__ import annotations

import os
from pathlib import Path

from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform
from pyproj import Transformer

SLOPE_CLASSES = [
    ("완경사(0-10°)", 0, 10),
    ("경사지(10-20°)", 10, 20),
    ("급경사(20-30°)", 20, 30),
    ("험준지(>30°)", 30, 1e9),
]


def _dem_dir() -> Path:
    from ..core.config import get_settings
    return Path(os.environ.get("DEM_DIR") or get_settings().dem_dir)


def _find_dem_for(geom_4326) -> str | None:
    """DEM_DIR 내 파일 중 필지 중심을 포함하는 첫 DEM 경로."""
    import rasterio
    d = _dem_dir()
    if not d.exists():
        return None
    lon, lat = geom_4326.centroid.x, geom_4326.centroid.y
    files = list(d.glob("*.img")) + list(d.glob("*.tif")) + list(d.glob("*.tiff"))
    for f in files:
        try:
            with rasterio.open(f) as ds:
                tr = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)
                x, y = tr.transform(lon, lat)
                b = ds.bounds
                if b.left <= x <= b.right and b.bottom <= y <= b.top:
                    return str(f)
        except Exception:
            continue
    return None


def analyze_slope(parcel_geom_geojson: dict) -> dict | None:
    """필지 폴리곤(GeoJSON, EPSG:4326)의 경사도 통계. DEM 없으면 None."""
    import numpy as np
    import rasterio
    from rasterio.mask import mask as rio_mask

    geom = shape(parcel_geom_geojson)
    dem_path = _find_dem_for(geom)
    if not dem_path:
        return None

    with rasterio.open(dem_path) as ds:
        tr = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)
        geom_dem = shp_transform(lambda x, y, z=None: tr.transform(x, y), geom)
        out, out_transform = rio_mask(
            ds, [mapping(geom_dem)], crop=True, filled=True, nodata=float("nan")
        )
        dem = out[0].astype("float64")

    px = abs(out_transform.a)   # x 픽셀 간격(m)
    py = abs(out_transform.e)   # y 픽셀 간격(m)
    if dem.shape[0] < 2 or dem.shape[1] < 2:
        return None
    dzdy, dzdx = np.gradient(dem, py, px)
    slope_deg = np.degrees(np.arctan(np.sqrt(dzdx ** 2 + dzdy ** 2)))

    valid = np.isfinite(slope_deg)
    n = int(valid.sum())
    if n == 0:
        return None
    sd = slope_deg[valid]
    px_area = px * py

    classes = []
    for label, lo, hi in SLOPE_CLASSES:
        cnt = int(((sd >= lo) & (sd < hi)).sum())
        classes.append({
            "label": label,
            "area_m2": round(cnt * px_area, 1),
            "ratio": round(cnt / n, 3),
        })
    return {
        "avg_deg": round(float(sd.mean()), 1),
        "max_deg": round(float(sd.max()), 1),
        "min_deg": round(float(sd.min()), 1),
        "pixel_count": n,
        "classes": classes,
        "source": "국토지리정보원 수치표고모델 5m",
    }
```

- [ ] **Step 2:** `python -c "import ast; ast.parse(open('backend/app/services/terrain.py',encoding='utf-8').read())"` → 에러 없음.
- [ ] **Step 3:** 커밋 `feat(terrain): DEM 경사도 분석 서비스(numpy gradient)`

---

## Task 3: 백엔드 라우터 + 등록

**Files:** Create `backend/app/routers/terrain.py`; Modify `backend/app/main.py`

- [ ] **Step 1:** 라우터 생성:
```python
from fastapi import APIRouter, HTTPException

from ..services.terrain import analyze_slope

router = APIRouter(prefix="/api/terrain", tags=["terrain"])


@router.post("/slope")
def slope(payload: dict):
    geom = payload.get("geometry")
    if not geom:
        raise HTTPException(status_code=422, detail="geometry (GeoJSON) required")
    try:
        result = analyze_slope(geom)
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"rasterio not available: {e}")
    if result is None:
        raise HTTPException(status_code=503, detail="DEM not configured")
    return result
```

- [ ] **Step 2:** `main.py` 에서 기존 라우터 등록부와 동일하게 추가(`from .routers import terrain` + `app.include_router(terrain.router)`). main.py 의 기존 `include_router` 패턴을 먼저 읽고 동일하게.
- [ ] **Step 3:** 앱 임포트 검증: `cd backend && python -c "from app.main import app; print('ok')"` (rasterio 미설치 환경이면 lazy import 라 임포트는 통과).
- [ ] **Step 4:** 커밋 `feat(terrain): /api/terrain/slope 라우터 등록`

---

## Task 4: 프론트 — 필지 클릭 시 경사 표시

**Files:** Modify `frontend/public/legacy-map/app.js` (필지 클릭 팝업 생성부 — `popup-row`/`지목` 표시하는 곳, 약 1442행 부근)

- [ ] **Step 1:** 필지 클릭 팝업에 경사 행 추가. 클릭된 필지 feature 의 geometry 를 POST:
```javascript
// 팝업 열릴 때 비동기로 경사 정보 채우기 (feature = 클릭된 필지 GeoJSON)
async function fillSlopeInfo(feature, popupEl) {
  try {
    const r = await fetch('/api/terrain/slope', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geometry: feature.geometry }),
    });
    if (!r.ok) return; // 503 = DEM 미설정 → 조용히 생략
    const s = await r.json();
    const row = `<div class="popup-row"><strong>경사도</strong><span>평균 ${s.avg_deg}° · 최대 ${s.max_deg}°</span></div>`;
    const steep = s.classes.filter(c => c.label.includes('급경사') || c.label.includes('험준'))
      .reduce((a, c) => a + c.area_m2, 0);
    const row2 = `<div class="popup-row"><strong>급경사(>20°)</strong><span>${Math.round(steep)}㎡</span></div>`;
    const host = popupEl.querySelector('.popup-slope');
    if (host) host.innerHTML = row + row2;
  } catch (e) { /* 무시 */ }
}
```
- [ ] **Step 2:** 기존 필지 팝업 HTML 에 `<div class="popup-slope"></div>` placeholder 추가하고, 팝업 open 시 `fillSlopeInfo(feature, popupEl)` 호출. (정확한 삽입 위치는 app.js 의 필지 클릭 핸들러를 읽고 결정 — `지목` 행 다음.)
- [ ] **Step 3:** `node --check frontend/public/legacy-map/app.js`
- [ ] **Step 4:** 커밋 `feat(legacy-map): 필지 클릭 시 경사도 정보 표시`

---

## Task 5: WMS 색 오버레이 검증 + 수동 검증

- [ ] **Step 1:** `⛰ 환경` 탭 "경사도(β)" 토글 ON → VWorld `lt_c_damden` 타일이 실제로 그려지는지 확인. 그려지면 index.html 에서 해당 라벨의 `(β)` 제거. 안 그려지면(빈 타일) 콘솔 tileerror 확인 후 보류(자체 경사 타일은 별도 과제).
- [ ] **Step 2:** (DEM 투입 후) 상교리 샘플 필지 클릭 → 경사 평균/최대 표시 확인. 값이 위성영상 지형 경사와 합리적으로 일치하는지.
- [ ] **Step 3:** DEM 미투입 시 503 으로 팝업에 경사 행이 조용히 생략되는지(에러 없이) 확인.

---

## 자가 점검
- 스펙 §3(서비스/라우터/프론트)·§5(검증) → Task 매핑. ✓
- DEM 미투입 시 503 graceful → 프론트 조용히 생략. ✓
- 식별자: `analyze_slope`/`/api/terrain/slope`/`fillSlopeInfo`/`popup-slope`/`DEM_DIR` 일치. ✓
- rasterio lazy import(forest_raster 동일) → GDAL 없는 환경서도 앱 기동. ✓
