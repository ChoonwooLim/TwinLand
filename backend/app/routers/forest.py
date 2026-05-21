"""산림 분석 API — 필지 폴리곤을 받아 임상도·산지구분도·산사태위험 교집합 계산.

엔드포인트:
- GET  /api/forest/status          : 적재 레이어 건수
- POST /api/forest/analyze          : 필지 폴리곤(GeoJSON) 분석 — 단건
- POST /api/forest/analyze-batch   : 여러 필지 일괄 분석
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..core.db import get_session
from ..core.config import get_settings
from ..services.forest_gis import (
    analyze_parcel, dataset_status,
    nearby_poi, nearby_poi_project,
    nearby_forest_roads_project,
)
from ..services.forest_raster import analyze_landslide_raster

router = APIRouter(prefix="/api/forest", tags=["forest"])


class AnalyzeRequest(BaseModel):
    parcel_no: int = Field(..., description="parcels.js 의 no")
    geometry: dict[str, Any] = Field(..., description="GeoJSON Polygon/MultiPolygon")
    layers: list[str] = Field(
        default_factory=lambda: ["imsang", "sanji", "landslide"],
        description="분석할 레이어 리스트",
    )


class AnalyzeBatchRequest(BaseModel):
    parcels: list[AnalyzeRequest]


@router.get("/status")
def status(db: Session = Depends(get_session)) -> dict:
    counts = dataset_status(db)
    from pathlib import Path as _P
    path = _landslide_path()
    raster_ready = bool(path and _P(path).exists())
    return {
        "loaded_layers": counts,
        "total_features": sum(counts.values()),
        "ready": bool(counts),
        # 새 이름 + 옛 이름 둘 다 반환 (프론트 하위호환)
        "landslide_raster_ready": raster_ready,
        "landslide_raster_path": path if raster_ready else None,
        "slope_raster_ready": raster_ready,
        "slope_raster_path": path if raster_ready else None,
    }


@router.post("/analyze")
def analyze(req: AnalyzeRequest, db: Session = Depends(get_session)) -> dict:
    try:
        return analyze_parcel(db, req.parcel_no, req.geometry, req.layers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"analyze 실패: {e}")


@router.post("/analyze-batch")
def analyze_batch(req: AnalyzeBatchRequest, db: Session = Depends(get_session)) -> dict:
    results = []
    for p in req.parcels:
        try:
            results.append(analyze_parcel(db, p.parcel_no, p.geometry, p.layers))
        except Exception as e:
            results.append({"parcel_no": p.parcel_no, "error": str(e)})

    # 프로젝트 전체 합계
    roll: dict[str, dict[str, dict[str, float]]] = {}  # layer -> category -> {area_m2, count}
    for r in results:
        if "error" in r:
            continue
        for layer, info in r.get("layers", {}).items():
            for item in info.get("items", []):
                cat = item["category"]
                roll.setdefault(layer, {}).setdefault(cat, {"area_m2": 0.0, "count": 0})
                roll[layer][cat]["area_m2"] += item["area_m2"]
                roll[layer][cat]["count"] += 1

    project_summary = {}
    for layer, cats in roll.items():
        items = [
            {
                "category": c,
                "area_m2": round(v["area_m2"], 1),
                "area_pyeong": round(v["area_m2"] / 3.305785, 1),
                "parcel_count": v["count"],
            }
            for c, v in cats.items()
        ]
        items.sort(key=lambda x: -x["area_m2"])
        project_summary[layer] = items

    return {"per_parcel": results, "project_summary": project_summary}


class NearbyPOIRequest(BaseModel):
    parcels: list[dict[str, Any]] = Field(
        ..., description="필지 GeoJSON geometry 배열 (parcel_no 는 불필요)"
    )
    radius_m: float = Field(3000.0, description="반경(미터)")
    limit: int = Field(500, description="반환 포인트 개수 상한")


@router.post("/nearby-poi")
def nearby_poi_endpoint(req: NearbyPOIRequest, db: Session = Depends(get_session)) -> dict:
    """여러 필지의 union 영역 주변 등산 시설 포인트 조회."""
    try:
        return nearby_poi_project(db, req.parcels, radius_m=req.radius_m, limit=req.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"nearby-poi 실패: {e}")


class NearbyPOIOneRequest(BaseModel):
    geometry: dict[str, Any]
    radius_m: float = 3000.0
    limit: int = 500


@router.post("/nearby-poi-one")
def nearby_poi_one(req: NearbyPOIOneRequest, db: Session = Depends(get_session)) -> dict:
    try:
        return nearby_poi(db, req.geometry, radius_m=req.radius_m, limit=req.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"nearby-poi-one 실패: {e}")


def _landslide_path() -> str:
    s = get_settings()
    # landslide_raster_path 우선, 없으면 slope_raster_path (옛 이름)
    return s.landslide_raster_path or s.slope_raster_path


class LandslideRequest(BaseModel):
    geometry: dict[str, Any]


@router.post("/landslide")
def landslide_analyze(req: LandslideRequest) -> dict:
    """파셀 폴리곤 + 산사태위험등급 래스터 zonal stats."""
    path = _landslide_path()
    if not path:
        raise HTTPException(status_code=503, detail="LANDSLIDE_RASTER_PATH 미설정")
    try:
        return analyze_landslide_raster(req.geometry, path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"landslide 실패: {e}")


class LandslideBatchRequest(BaseModel):
    parcels: list[dict[str, Any]] = Field(..., description="GeoJSON geometry 배열")


@router.post("/landslide-batch")
def landslide_batch(req: LandslideBatchRequest) -> dict:
    """여러 파셀 union 한 번에 산사태위험 분석."""
    path = _landslide_path()
    if not path:
        raise HTTPException(status_code=503, detail="LANDSLIDE_RASTER_PATH 미설정")
    if not req.parcels:
        return {"total_pixels": 0, "items": []}
    try:
        from shapely.ops import unary_union
        from shapely.geometry import shape, mapping
        union = unary_union([shape(g) for g in req.parcels])
        return analyze_landslide_raster(mapping(union), path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"landslide-batch 실패: {e}")


# 옛 이름 별칭 (하위 호환)
@router.post("/slope")
def slope_analyze_alias(req: LandslideRequest) -> dict:
    return landslide_analyze(req)


@router.post("/slope-batch")
def slope_batch_alias(req: LandslideBatchRequest) -> dict:
    return landslide_batch(req)


class ForestRoadsRequest(BaseModel):
    parcels: list[dict[str, Any]] = Field(..., description="GeoJSON geometry 배열")
    radius_m: float = Field(2000.0, description="반경(m)")
    limit: int = 50


@router.post("/forest-roads")
def forest_roads_endpoint(req: ForestRoadsRequest, db: Session = Depends(get_session)) -> dict:
    """파셀 union 주변 임도 (LineString) 거리순 + 교차 여부."""
    try:
        return nearby_forest_roads_project(db, req.parcels, radius_m=req.radius_m, limit=req.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"forest-roads 실패: {e}")
