"""래스터 (GeoTIFF) 기반 산림 데이터 zonal statistics.

FGIS 는 산사태위험등급(DATA016, 1~5) 등 일부 자료를 래스터로 배포. 필지
폴리곤마다 래스터 픽셀 분포(등급별 픽셀 수·면적)를 계산.

래스터 원본은 파일시스템 그대로 보관 (DB 부적합 — 수백 MB). 설정으로
경로만 관리.
"""
from __future__ import annotations

from pathlib import Path

# 주의: rasterio 는 시스템 GDAL/GEOS/PROJ/libexpat 의존.
# Orbitron 기본 이미지에 해당 lib 가 없을 수 있으므로 **lazy import** 로 전환.
# 모듈 import 실패가 앱 전체를 막지 않도록, 실제 분석 함수 호출 시점에만 로드.

from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform
from pyproj import Transformer


LANDSLIDE_GRADE_LABELS = {
    1: "1등급 (매우 높음)",
    2: "2등급 (높음)",
    3: "3등급 (보통)",
    4: "4등급 (낮음)",
    5: "5등급 (매우 낮음)",
}

# (옛 이름 호환 — 향후 제거 가능)
SLOPE_GRADE_LABELS = LANDSLIDE_GRADE_LABELS


def analyze_landslide_raster(
    parcel_geom_geojson: dict,
    raster_path: str,
    class_labels: dict | None = None,
) -> dict:
    """파셀 폴리곤과 산사태위험등급 래스터를 교차해 등급별 픽셀·면적 분포 반환."""
    # lazy import — GDAL/libexpat 없는 환경에서도 서비스 전체는 기동.
    try:
        import numpy as np
        import rasterio
        from rasterio.mask import mask as rio_mask
    except ImportError as e:
        return {"error": f"rasterio/numpy import 실패 (GDAL·libexpat 미설치): {e}"}

    labels = class_labels or LANDSLIDE_GRADE_LABELS
    rp = Path(raster_path)
    if not rp.exists():
        return {"error": f"raster not found: {raster_path}"}

    parcel = shape(parcel_geom_geojson)

    with rasterio.open(str(rp)) as src:
        # 파셀(EPSG:4326) → 래스터 CRS 로 투영
        if str(src.crs).upper() not in ("EPSG:4326", ""):
            fwd = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True).transform
            parcel_rc = shp_transform(fwd, parcel)
        else:
            parcel_rc = parcel

        try:
            img, out_transform = rio_mask(src, [mapping(parcel_rc)], crop=True, nodata=src.nodata or 0)
        except Exception as e:
            return {"error": f"rio_mask 실패: {e}"}

        arr = img[0]  # 단일 밴드 가정
        # nodata 제거
        nodata = src.nodata
        if nodata is not None:
            valid = arr[arr != nodata]
        else:
            valid = arr[arr > 0]

        if valid.size == 0:
            return {"total_pixels": 0, "items": [], "coverage_pct": 0}

        # 픽셀당 면적 (해상도^2)
        xres = abs(out_transform.a)
        yres = abs(out_transform.e)
        px_m2 = xres * yres

        uniq, counts = np.unique(valid, return_counts=True)
        total = counts.sum()

        items = []
        for v, c in sorted(zip(uniq, counts), key=lambda x: x[0]):
            v_int = int(v)
            area_m2 = float(c) * px_m2
            items.append({
                "grade": v_int,
                "label": labels.get(v_int, str(v_int)),
                "pixels": int(c),
                "area_m2": round(area_m2, 1),
                "area_pyeong": round(area_m2 / 3.305785, 1),
                "pct": round(float(c) / total * 100, 2),
            })

    total_area = sum(x["area_m2"] for x in items)
    return {
        "total_pixels": int(total),
        "total_area_m2": round(total_area, 1),
        "pixel_size_m": round(xres, 2),
        "items": items,
    }


# 옛 이름 호환
analyze_slope_raster = analyze_landslide_raster
