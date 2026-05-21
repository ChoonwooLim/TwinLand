#!/usr/bin/env python
"""시도별 등산로 포인트 SHP (FGIS DATA001) → DB 적재.

FGIS 산림청이 배포하는 `<시도코드>.zip` 형태(예: 11.zip=서울, 41.zip=경기) 를
일괄 처리. 각 ZIP 안에는 `<코드>.shp/.dbf/.shx/.prj` 가 있음.

각 포인트 속성:
- MNTN_NM    : 산 이름
- MNTN_CODE  : 산 코드
- MNTN_ID    : 산 ID
- DETAIL_SPO : 시설 상세 (이정표/갈림길/정상/화장실/안내판 등)
- PMNTN_SPOT : 주등산로 지점 번호
- MANAGE_SP1/2, ETC_MATTER ...

사용:
    # 전국 모든 시도 ZIP 처리 (기본 `FOREST_SHP_DIR` 아래 *.zip 모두)
    python -m backend.scripts.ingest_mountain_poi --source-dir /data/forest/mountain_poi --truncate

    # BBOX 제한 (프로젝트 영역 근처만 — PROJECT_BBOX + 여유 반경)
    python -m backend.scripts.ingest_mountain_poi --bbox 127.50,37.30,127.85,37.60 --buffer-km 5
"""
from __future__ import annotations

import argparse
import sys
import zipfile
import tempfile
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "backend"))
sys.path.insert(0, str(_REPO))

from app.core.config import get_settings  # noqa: E402
from backend.scripts.ingest_forest_shp import ingest_one_layer, parse_bbox, BBox  # noqa: E402


PROVINCE_NAMES = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기", "42": "강원",
    "43": "충북", "44": "충남", "45": "전북", "46": "전남", "47": "경북",
    "48": "경남", "50": "제주",
}


def expand_bbox(bbox: BBox, buffer_km: float) -> BBox:
    """BBOX 에 반경(km) 버퍼 추가. 위경도 근사치 (km / 111)."""
    d = buffer_km / 111.0
    return (bbox[0] - d, bbox[1] - d, bbox[2] + d, bbox[3] + d)


def find_shp_in_zip(zip_path: Path, tmp_dir: Path) -> Path | None:
    """ZIP 을 풀어서 내부 .shp 파일 경로 반환."""
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(tmp_dir)
    shps = list(tmp_dir.glob("**/*.shp"))
    return shps[0] if shps else None


def main():
    settings = get_settings()

    ap = argparse.ArgumentParser()
    ap.add_argument("--source-dir", default=settings.forest_shp_dir or "",
                    help="시도별 ZIP 파일들이 있는 디렉토리")
    ap.add_argument("--bbox", default=settings.project_bbox,
                    help="BBOX 필터 (lngMin,latMin,lngMax,latMax). 비우면 전국 전부")
    ap.add_argument("--buffer-km", type=float, default=0.0,
                    help="BBOX 에 추가할 반경(km). 주변 POI 까지 포함하려면 5~20 권장")
    ap.add_argument("--truncate", action="store_true",
                    help="mountain_poi 기존 데이터 삭제 후 적재")
    ap.add_argument("--codes", default="",
                    help="처리할 시도 코드만 (쉼표구분, 예: 41,43). 비우면 전체")
    args = ap.parse_args()

    if not args.source_dir:
        sys.exit("--source-dir 또는 FOREST_SHP_DIR 필요")
    src_dir = Path(args.source_dir)
    if not src_dir.is_dir():
        sys.exit(f"디렉토리 없음: {src_dir}")

    bbox = parse_bbox(args.bbox) if args.bbox else None
    if bbox and args.buffer_km > 0:
        bbox = expand_bbox(bbox, args.buffer_km)
        print(f"[bbox] 버퍼 {args.buffer_km}km 적용 → {bbox}")

    # 쿼리 필터용 BBOX — 없으면 대한민국 전체 대충
    q_bbox = bbox if bbox else (124.0, 33.0, 132.0, 39.0)

    zips = sorted(src_dir.glob("*.zip"))
    code_filter = {c.strip() for c in args.codes.split(",") if c.strip()}

    # 파일명(확장자 제거)이 시도 코드 — 필터 적용
    targets = []
    for z in zips:
        stem = z.stem
        if code_filter and stem not in code_filter:
            continue
        if not stem.isdigit():
            continue  # 11, 26 등 숫자 코드만
        targets.append((stem, z))

    if not targets:
        sys.exit(f"처리할 ZIP 없음 (디렉토리={src_dir}, 필터={code_filter or '없음'})")

    print(f"[plan] {len(targets)}개 시도 처리: {', '.join(t[0] for t in targets)}")

    # 최초 호출만 truncate, 이후는 누적
    truncate_first = args.truncate
    total_inserted = 0
    total_skipped = 0
    summary: list[dict] = []

    for code, zip_path in targets:
        pname = PROVINCE_NAMES.get(code, code)
        print(f"\n=== {code} ({pname}) ← {zip_path.name} ===")
        with tempfile.TemporaryDirectory() as td:
            shp = find_shp_in_zip(zip_path, Path(td))
            if not shp:
                print(f"[skip] .shp 없음")
                summary.append({"code": code, "name": pname, "status": "no_shp"})
                continue
            result = ingest_one_layer(
                layer="mountain_poi",
                shp_path=str(shp),
                bbox=q_bbox,
                truncate=truncate_first,
                chunk=1000,
            )
            truncate_first = False  # 첫 ZIP 에서만
            total_inserted += result.get("inserted", 0)
            total_skipped += result.get("skipped", 0)
            summary.append({"code": code, "name": pname, **result})

    print("\n=== 시도별 적재 요약 ===")
    for s in summary:
        print(f"  [{s['code']} {s['name']:<4}] {s.get('status','?'):<10} "
              f"inserted={s.get('inserted',0):<6} skipped={s.get('skipped',0)}")
    print(f"\n합계: inserted={total_inserted}, skipped={total_skipped}")


if __name__ == "__main__":
    main()
