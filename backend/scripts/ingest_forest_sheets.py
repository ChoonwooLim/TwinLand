#!/usr/bin/env python
"""1:5,000 도엽 단위 SHP ZIP 묶음을 한 레이어로 일괄 적재.

FGIS 는 임상도·산지구분도·산사태위험도 등 폴리곤 데이터를 **도엽 단위 ZIP**
으로만 배포한다 (예: 37706087.zip, 37711009.zip ...). 이 스크립트는 지정
디렉토리의 모든 ZIP 을 풀어서 같은 layer_type 로 연속 적재.

속성 스키마로 레이어 자동 판정 (`--layer auto`):
- FRTP_CD / KOFTR_GROU      → imsang (임상도)
- SANJI / sanji_gbn         → sanji  (산지구분도)
- LSLRSK / grade (산사태)   → landslide
- SOIL / forest_soil         → soil

사용:
    # 레이어 고정
    python -m backend.scripts.ingest_forest_sheets \\
        --layer imsang \\
        --source-dir /data/forest/imsang_sheets/ \\
        --truncate

    # 자동 판정 (디렉토리에 섞여있는 경우)
    python -m backend.scripts.ingest_forest_sheets \\
        --layer auto \\
        --source-dir /data/forest/all_sheets/ \\
        --truncate
"""
from __future__ import annotations

import argparse
import sys
import zipfile
import tempfile
from pathlib import Path

import pyogrio

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "backend"))
sys.path.insert(0, str(_REPO))

from app.core.config import get_settings  # noqa: E402
from backend.scripts.ingest_forest_shp import ingest_one_layer, parse_bbox  # noqa: E402


# 속성 컬럼 스키마로 레이어 자동 판정
def detect_layer(fields: list[str]) -> str:
    lower = {f.lower() for f in fields}
    # forest_road (DATA019): LineString 임도
    if any(k in lower for k in ("frrd_nm", "frrd_fcltd", "frrd_estbl", "frrd_fcltw", "frrd_instt")):
        return "forest_road"
    # forest_function (DATA031): 산림기능구분
    if all(k in lower for k in ("pf", "wrcf", "fdmf", "eecf", "frcf")):
        return "forest_function"
    # state/public forest (DATA021/022)
    if any(k in lower for k in ("clas_ow", "pnu_cd")) and any(k in lower for k in ("comp_nm", "gov_ct")):
        return "state_forest"  # 국/공 구분은 classify 가 내용 보고 정함
    if any(k in lower for k in ("frtp_cd", "frtp_nm", "koftr_nm", "dmcls_cd", "agcls_cd")):
        return "imsang"
    # productivity (DATA014): 수종별 지위지수
    if any(k in lower for k in ("stqgd_val", "larch_stin", "krpn_stind", "cndst_pine", "actsm_stin")):
        return "productivity"
    # soil (DATA015): 모암·토심·토성·경사
    if any(k in lower for k in ("prrck_larg", "sldpt_tpcd", "scstx_cd", "sltp_cd", "eight_agl")):
        return "soil"
    if any(k in lower for k in ("sanji", "sanji_gbn", "mt_cbnd", "sanji_code")):
        return "sanji"
    if any(k in lower for k in ("lslrsk", "landslide_risk", "mt_lslrsk", "risk_grade")):
        return "landslide"
    if any(k in lower for k in ("mntn_nm", "mntn_code", "mntn_id", "pmntn_spot")):
        return "mountain_poi"
    return "unknown"


def find_shp_in_zip(zip_path: Path, tmp_dir: Path) -> Path | None:
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(tmp_dir)
    shps = list(tmp_dir.glob("**/*.shp"))
    return shps[0] if shps else None


def main():
    settings = get_settings()

    ap = argparse.ArgumentParser()
    ap.add_argument("--layer", required=True,
                    choices=[
                        "imsang", "sanji", "landslide", "soil", "productivity", "mountain_poi",
                        "forest_road", "state_forest", "private_forest", "public_forest",
                        "forest_function", "auto",
                    ],
                    help="적재할 레이어. 'auto' 면 SHP 컬럼 스키마로 자동 판정")
    ap.add_argument("--source-dir", required=True, help="도엽 ZIP 이 모여있는 디렉토리")
    ap.add_argument("--bbox", default=settings.project_bbox,
                    help="BBOX 필터. 비우면 ZIP 안 전체")
    ap.add_argument("--truncate", action="store_true",
                    help="첫 도엽 적재 전 해당 layer_type 기존 데이터 삭제")
    ap.add_argument("--srid-override", type=int, default=None,
                    help=".prj 결손 시 수동 (예: 5179)")
    ap.add_argument("--pattern", default="*.zip",
                    help="glob 패턴 (기본 *.zip)")
    args = ap.parse_args()

    src_dir = Path(args.source_dir)
    if not src_dir.is_dir():
        sys.exit(f"디렉토리 없음: {src_dir}")

    try:
        bbox = parse_bbox(args.bbox) if args.bbox else None
    except ValueError as e:
        sys.exit(f"BBOX 파싱 실패: {e}")

    q_bbox = bbox if bbox else (124.0, 33.0, 132.0, 39.0)  # 대한민국

    zips = sorted(src_dir.glob(args.pattern))
    if not zips:
        sys.exit(f"ZIP 없음: {src_dir}/{args.pattern}")
    print(f"[plan] {len(zips)} 개 도엽 ZIP 처리 → layer={args.layer}")
    print(f"[plan] bbox 필터={bbox}")

    truncate_first = args.truncate
    totals: dict[str, dict] = {}   # layer -> {inserted, skipped, sheets}

    for zp in zips:
        stem = zp.stem
        print(f"\n=== {stem} ({zp.name}) ===")
        with tempfile.TemporaryDirectory() as td:
            try:
                shp = find_shp_in_zip(zp, Path(td))
            except Exception as e:
                print(f"[error] ZIP 풀기 실패: {e}")
                continue
            if not shp:
                print("[skip] .shp 없음")
                continue

            # 레이어 판정
            if args.layer == "auto":
                try:
                    info = pyogrio.read_info(str(shp))
                    layer = detect_layer(list(info["fields"]))
                except Exception as e:
                    print(f"[skip] 스키마 읽기 실패: {e}")
                    continue
                if layer == "unknown":
                    print(f"[skip] 레이어 자동 판정 실패 (columns={list(info['fields'])[:5]}...)")
                    continue
                print(f"[auto] 감지된 레이어: {layer}")
            else:
                layer = args.layer

            # 같은 layer 최초 ZIP 에서만 truncate
            do_truncate = truncate_first and layer not in totals
            result = ingest_one_layer(
                layer=layer,
                shp_path=str(shp),
                bbox=q_bbox,
                truncate=do_truncate,
                srid_override=args.srid_override,
            )
            entry = totals.setdefault(layer, {"inserted": 0, "skipped": 0, "sheets": 0})
            entry["inserted"] += result.get("inserted", 0)
            entry["skipped"] += result.get("skipped", 0)
            entry["sheets"] += 1

    print("\n=== 레이어별 합계 ===")
    for layer, t in totals.items():
        print(f"  {layer:<14} sheets={t['sheets']:<3} inserted={t['inserted']:<6} skipped={t['skipped']}")


if __name__ == "__main__":
    main()
