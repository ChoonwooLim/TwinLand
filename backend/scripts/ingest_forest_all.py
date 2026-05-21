#!/usr/bin/env python
"""전국 SHP 원본 → 프로젝트 BBOX 로 한 번에 모든 레이어 적재.

prerequisites:
    - FOREST_SHP_DIR 환경변수 또는 --shp-dir 로 원본 디렉토리 지정
    - PROJECT_BBOX 환경변수 또는 --bbox 로 프로젝트 범위 지정
    - SHP 파일 명명 규칙: imsang.shp / sanji.shp / landslide.shp / soil.shp
      (실제 FGIS 파일명이 다르면 --layer-file 오버라이드 또는 심볼릭 링크)

예:
    # .env 에 FOREST_SHP_DIR, PROJECT_BBOX 세팅됐을 때
    python -m backend.scripts.ingest_forest_all --truncate

    # 명시 인자
    python -m backend.scripts.ingest_forest_all \\
        --shp-dir /data/forest/nationwide \\
        --bbox 127.50,37.30,127.85,37.60 \\
        --layers imsang,sanji,landslide \\
        --truncate
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "backend"))
sys.path.insert(0, str(_REPO))

from app.core.config import get_settings  # noqa: E402
from backend.scripts.ingest_forest_shp import ingest_one_layer, parse_bbox  # noqa: E402


# 각 레이어에 대해 SHP 파일명 후보 (첫 번째로 존재하는 파일 사용)
# FGIS 에서 받는 실제 파일명이 다르면 이 매핑에 추가.
LAYER_FILENAME_CANDIDATES: dict[str, list[str]] = {
    "imsang": [
        "imsang.shp",
        "FRTP_S.shp",      # FGIS 임상도 내부 명
        "forest_type.shp",
    ],
    "sanji": [
        "sanji.shp",
        "MT_CBND.shp",      # FGIS 산지구분도 내부 명 후보
        "sanji_gbn.shp",
        "forest_class.shp",
    ],
    "landslide": [
        "landslide.shp",
        "landslide_risk.shp",
        "MT_LSLRSK.shp",
    ],
    "soil": [
        "soil.shp",
        "forest_soil.shp",
        "FSCM_S.shp",
    ],
}


def resolve_layer_file(shp_dir: Path, layer: str) -> Path | None:
    candidates = LAYER_FILENAME_CANDIDATES.get(layer, [f"{layer}.shp"])
    for name in candidates:
        p = shp_dir / name
        if p.exists():
            return p
    return None


def main():
    settings = get_settings()

    ap = argparse.ArgumentParser()
    ap.add_argument("--shp-dir", default=settings.forest_shp_dir or "",
                    help="전국 SHP 원본 디렉토리 (.env FOREST_SHP_DIR)")
    ap.add_argument("--bbox", default=settings.project_bbox,
                    help="프로젝트 BBOX lngMin,latMin,lngMax,latMax")
    ap.add_argument("--layers", default="imsang,sanji,landslide",
                    help="쉼표 구분 레이어 목록 (기본: imsang,sanji,landslide)")
    ap.add_argument("--truncate", action="store_true",
                    help="각 레이어 적재 전 기존 데이터 삭제")
    ap.add_argument("--srid-override", type=int, default=None,
                    help="SHP .prj 결손 시 수동 지정 (예: 5179)")
    args = ap.parse_args()

    if not args.shp_dir:
        sys.exit("FOREST_SHP_DIR 가 설정되지 않음. .env 또는 --shp-dir 로 지정.")
    shp_dir = Path(args.shp_dir)
    if not shp_dir.is_dir():
        sys.exit(f"SHP 디렉토리 없음: {shp_dir}")

    try:
        bbox = parse_bbox(args.bbox)
    except ValueError as e:
        sys.exit(f"BBOX 파싱 실패: {e}")

    layers = [s.strip() for s in args.layers.split(",") if s.strip()]
    print(f"[config] project={settings.project_name} bbox={bbox} shp_dir={shp_dir}")
    print(f"[config] layers={layers} truncate={args.truncate}")

    overall = []
    for layer in layers:
        file_path = resolve_layer_file(shp_dir, layer)
        if file_path is None:
            print(f"[skip] {layer}: 후보 파일 없음 (후보={LAYER_FILENAME_CANDIDATES.get(layer)})")
            overall.append({"layer": layer, "status": "missing_file", "inserted": 0})
            continue
        print(f"\n=== {layer} ← {file_path.name} ===")
        result = ingest_one_layer(
            layer=layer,
            shp_path=str(file_path),
            bbox=bbox,
            truncate=args.truncate,
            srid_override=args.srid_override,
        )
        overall.append({"layer": layer, **result})

    # 결과 요약
    print("\n=== 적재 요약 ===")
    for r in overall:
        print(f"  {r['layer']:<10} {r.get('status','?'):<12} "
              f"inserted={r.get('inserted',0)} message={r.get('message','')}")


if __name__ == "__main__":
    main()
