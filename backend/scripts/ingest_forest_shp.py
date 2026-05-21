#!/usr/bin/env python
"""산림청 SHP → DB 적재 스크립트 (단일 레이어).

CLI 사용:
    python -m backend.scripts.ingest_forest_shp \
        --layer imsang --file /path/to/imsang.shp \
        --bbox 127.68,37.42,127.82,37.55 [--truncate]

함수 사용:
    from backend.scripts.ingest_forest_shp import ingest_one_layer
    ingest_one_layer(layer='imsang', shp_path='...', bbox=(..., ..., ..., ...), truncate=True)

양평 BBOX 예: 127.50,37.30,127.85,37.60

pyogrio 는 GeoPandas 없이 SHP/GPKG 읽는 C 가속 라이브러리.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import pyogrio
from shapely.ops import transform as shp_transform
from shapely import wkb as shp_wkb
from pyproj import CRS, Transformer
from sqlmodel import Session, delete

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "backend"))   # backend/ — `from app.*` 경로 통일

from app.core.db import engine, init_db  # noqa: E402
from app.models.forest import ForestFeature, ForestIngestLog  # noqa: E402


WGS84 = CRS.from_epsg(4326)

# 최초 호출 시 테이블 생성 (모듈 레벨에서 한 번)
_INITIALIZED = False

def _ensure_tables():
    global _INITIALIZED
    if not _INITIALIZED:
        init_db()
        _INITIALIZED = True

BBox = tuple[float, float, float, float]  # (lngMin, latMin, lngMax, latMax)


def parse_bbox(s: str) -> BBox:
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox 는 lngMin,latMin,lngMax,latMax 4개")
    return (parts[0], parts[1], parts[2], parts[3])


def ingest_one_layer(
    layer: str,
    shp_path: str,
    bbox: BBox,
    truncate: bool = False,
    srid_override: Optional[int] = None,
    chunk: int = 500,
    verbose: bool = True,
) -> dict:
    """단일 SHP → layer 로 DB 적재.

    반환: {"status": "ok"|"error", "inserted": N, "skipped": N, "message": ...}
    """
    _ensure_tables()
    src = Path(shp_path)
    if not src.exists():
        return {"status": "error", "inserted": 0, "skipped": 0, "message": f"file not found: {src}"}

    log_fn = print if verbose else (lambda *_a, **_k: None)

    # 원본 SHP CRS 파악. pyogrio 가 .prj 의 ESRI 확장 문자열 파싱 실패 시 None 반환.
    # 한국 산림청 SHP 는 사실상 EPSG:5179 (UTM-K) 이므로 fallback.
    info = pyogrio.read_info(str(src))
    raw_crs = info.get("crs")
    src_crs = srid_override or raw_crs
    if not src_crs:
        log_fn(f"[warn] CRS 자동 인식 실패 — EPSG:5179 로 fallback (한국 산림 SHP 표준)")
        src_crs = 5179

    src_crs_obj = CRS.from_user_input(src_crs)
    to_wgs = Transformer.from_crs(src_crs_obj, WGS84, always_xy=True).transform

    # EPSG:4326 BBOX → 원본 CRS BBOX 로 변환 (네 모서리 투영 후 min/max)
    from_wgs = Transformer.from_crs(WGS84, src_crs_obj, always_xy=True).transform
    xs, ys = zip(*[
        from_wgs(bbox[0], bbox[1]),
        from_wgs(bbox[0], bbox[3]),
        from_wgs(bbox[2], bbox[1]),
        from_wgs(bbox[2], bbox[3]),
    ])
    src_bbox = (min(xs), min(ys), max(xs), max(ys))
    log_fn(f"[read] {src.name} CRS={src_crs_obj.to_epsg()} src_bbox={tuple(round(v,1) for v in src_bbox)}")

    # pyogrio 로 bbox 필터 읽기
    try:
        gdf = pyogrio.read_dataframe(str(src), bbox=src_bbox)
    except Exception as e:
        return {"status": "error", "inserted": 0, "skipped": 0, "message": f"pyogrio 읽기 실패: {e}"}

    if gdf is None or len(gdf) == 0:
        log_fn("[warn] 매칭 피처 0건.")
        return {"status": "ok", "inserted": 0, "skipped": 0, "message": "0 features in bbox"}

    log_fn(f"[read] {len(gdf)} features in bbox")

    inserted = 0
    skipped = 0
    now = datetime.utcnow()

    with Session(engine) as db:
        log_row = ForestIngestLog(
            layer_type=layer,
            source_file=src.name,
            bbox_filter=",".join(f"{v:.5f}" for v in bbox),
            started_at=now,
        )
        db.add(log_row); db.commit(); db.refresh(log_row)

        if truncate:
            db.exec(delete(ForestFeature).where(ForestFeature.layer_type == layer))
            db.commit()
            log_fn(f"[truncate] layer={layer} 기존 데이터 삭제")

        batch: list[ForestFeature] = []
        for _idx, row in gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                skipped += 1
                continue
            # 원본 CRS → WGS84 변환
            geom_wgs = shp_transform(to_wgs, geom)
            # BBOX 2차 검증
            minx, miny, maxx, maxy = geom_wgs.bounds
            if maxx < bbox[0] or minx > bbox[2] or maxy < bbox[1] or miny > bbox[3]:
                skipped += 1
                continue

            # 속성 (geometry 제외)
            attrs: dict = {}
            for col in gdf.columns:
                if col == "geometry":
                    continue
                v = row[col]
                try:
                    if hasattr(v, "item"):
                        v = v.item()
                except Exception:
                    v = str(v)
                if v is None or v != v:  # NaN
                    continue
                attrs[str(col)] = v

            feat = ForestFeature(
                layer_type=layer,
                geom_type=geom_wgs.geom_type,
                source_file=src.name,
                min_lng=minx, max_lng=maxx,
                min_lat=miny, max_lat=maxy,
                attrs=attrs,
                geom_wkb=shp_wkb.dumps(geom_wgs, output_dimension=2),
                area_m2=0.0,
                ingested_at=now,
            )
            batch.append(feat)
            if len(batch) >= chunk:
                db.add_all(batch); db.commit()
                inserted += len(batch)
                log_fn(f"  [ingest] +{len(batch)} (total {inserted})")
                batch = []

        if batch:
            db.add_all(batch); db.commit()
            inserted += len(batch)

        log_row.inserted_count = inserted
        log_row.skipped_count = skipped
        log_row.status = "ok"
        log_row.finished_at = datetime.utcnow()
        db.add(log_row); db.commit()

    log_fn(f"[done] layer={layer} inserted={inserted} skipped={skipped}")
    return {"status": "ok", "inserted": inserted, "skipped": skipped, "message": f"from {src.name}"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--layer", required=True, choices=[
        "imsang", "sanji", "landslide", "soil", "productivity",
        "mountain_poi", "forest_road", "state_forest", "private_forest",
        "public_forest",  # 옛 이름 호환
        "forest_function",
    ])
    ap.add_argument("--file", required=True)
    ap.add_argument("--bbox", required=True, help="lngMin,latMin,lngMax,latMax (EPSG:4326)")
    ap.add_argument("--srid-override", type=int, default=None)
    ap.add_argument("--truncate", action="store_true")
    ap.add_argument("--chunk", type=int, default=500)
    args = ap.parse_args()

    result = ingest_one_layer(
        layer=args.layer,
        shp_path=args.file,
        bbox=parse_bbox(args.bbox),
        truncate=args.truncate,
        srid_override=args.srid_override,
        chunk=args.chunk,
    )
    if result["status"] == "error":
        sys.exit(result["message"])


if __name__ == "__main__":
    main()
