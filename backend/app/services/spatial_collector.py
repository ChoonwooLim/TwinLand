"""필지별 공간 데이터 수집 (MVP: 입력 필지 → enrichment).

프론트엔드가 /api/vworld, /api/parcels, /api/forest 로 미리 받아온 데이터를
그대로 받거나, 필요 시 서버 사이드에서 추가 수집한다.

전체 정합을 위해 다음 필드를 표준 dict 로 정규화:
  parcel = {
    "no": int, "pnu": str|None, "address": str, "lot": str, "location": str,
    "category": str, "area_m2": float, "area_pyeong": float,
    "owner": str|None, "memo": str|None,
    "geometry": dict (GeoJSON) | None,
    "centroid": [lng, lat] | None,
    # GIS enrichment (선택적)
    "slope_stats": {"max_deg": float, "mean_deg": float, ...} | None,
    "landslide_class_dist": {1: float, 2: float, ...} | None,
    "forest": {"imsang": {...}, "sanji": {...}} | None,
    "landuse": {"zoning": str, "designations": list[str]} | None,
  }
"""
from __future__ import annotations

from typing import Any


def normalize_parcel(raw: dict[str, Any]) -> dict[str, Any]:
    """입력 raw parcel 을 표준 형식으로 정규화. 누락 필드는 빈 값."""
    area_m2 = float(raw.get("area_m2") or 0)
    area_pyeong = float(raw.get("area_pyeong") or round(area_m2 * 0.3025))
    return {
        "no": raw.get("no"),
        "pnu": raw.get("pnu"),
        "address": raw.get("address") or "",
        "lot": raw.get("lot") or "",
        "location": raw.get("location") or "",
        "category": raw.get("category") or "—",
        "area_m2": area_m2,
        "area_pyeong": area_pyeong,
        "owner": raw.get("owner") or "—",
        "memo": raw.get("memo") or "",
        "geometry": raw.get("geometry"),
        "centroid": raw.get("centroid"),
        "slope_stats": raw.get("slope_stats"),
        "landslide_class_dist": raw.get("landslide_class_dist"),
        "forest": raw.get("forest"),
        "landuse": raw.get("landuse"),
    }


def aggregate_summary(parcels: list[dict[str, Any]]) -> dict[str, Any]:
    """전체 필지의 합산 통계 (보고서 §1·§2 핵심 결론용)."""
    total_m2 = sum(p["area_m2"] for p in parcels)
    total_pyeong = sum(p["area_pyeong"] for p in parcels)
    by_category: dict[str, float] = {}
    for p in parcels:
        cat = p["category"]
        by_category[cat] = by_category.get(cat, 0) + p["area_m2"]
    return {
        "parcel_count": len(parcels),
        "total_area_m2": total_m2,
        "total_area_pyeong": total_pyeong,
        "total_area_ha": round(total_m2 / 10000, 4),
        "area_by_category_m2": by_category,
    }


def collect(parcels_input: list[dict[str, Any]]) -> dict[str, Any]:
    """파이프라인 진입점: 입력 필지 리스트 → 정규화 + 합산."""
    parcels = [normalize_parcel(p) for p in parcels_input]
    summary = aggregate_summary(parcels)
    return {
        "parcels": parcels,
        "summary": summary,
    }
