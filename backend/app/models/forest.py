"""산림청 SHP 적재용 모델.

PostGIS 없이 shapely 로 Python 측 처리 — geometry 는 WKB(bytes) 로 저장하고
bbox 4 개 컬럼으로 1 차 필터, 그 뒤 shapely 로 실제 교집합 계산.

레이어 종류 (layer_type):
- 'imsang'      : 임상도 (임종/임상/수종/경급/영급/수관밀도) — Polygon
- 'sanji'       : 산지구분도 (보전/준보전/임업용/공익용) — Polygon
- 'landslide'   : 산사태위험지도 (등급) — Polygon
- 'soil'        : 산림입지토양도 — Polygon
- 'mountain_poi': 등산로 시설·포인트(이정표·갈림길·정상·화장실 등) — Point
"""
from __future__ import annotations

from typing import Optional, Any
from datetime import datetime

from sqlalchemy import Column, LargeBinary, Index
from sqlalchemy.types import JSON
from sqlmodel import SQLModel, Field


class ForestFeature(SQLModel, table=True):
    """단일 폴리곤 피처. SHP 한 행을 그대로 담음.

    - `geom_wkb`: shapely Polygon/MultiPolygon 의 WKB 바이트 (EPSG:4326)
    - `attrs`: SHP 속성 그대로 (지목 코드·등급·수종 등). 스키마는 레이어마다 다름
    - `min_lng/max_lng/min_lat/max_lat`: BBOX 사전 필터 — 인덱스로 범위 쿼리 빠르게
    """

    __tablename__ = "forest_feature"

    id: Optional[int] = Field(default=None, primary_key=True)
    layer_type: str = Field(index=True, max_length=32, description="imsang / sanji / landslide / soil / mountain_poi")
    geom_type: str = Field(default="Polygon", max_length=16, description="Point / Polygon / MultiPolygon")
    source_file: Optional[str] = Field(default=None, max_length=256)

    # BBOX (EPSG:4326, 도 단위). 1 차 필터용
    min_lng: float = Field(index=True)
    max_lng: float = Field(index=True)
    min_lat: float = Field(index=True)
    max_lat: float = Field(index=True)

    # SHP 속성 (레이어마다 다름 — JSON 로 그대로 보관)
    attrs: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # 실제 지오메트리
    geom_wkb: bytes = Field(sa_column=Column(LargeBinary, nullable=False))

    # 메타
    area_m2: float = Field(default=0.0, description="geodesic 면적 근사. 계산 시점 값")
    ingested_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        Index("ix_forest_feature_bbox", "layer_type", "min_lng", "max_lng", "min_lat", "max_lat"),
    )


class ForestIngestLog(SQLModel, table=True):
    """적재 이력 — 한 번에 몇 건 적재됐는지, 성공/실패 여부."""

    __tablename__ = "forest_ingest_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    layer_type: str = Field(max_length=32)
    source_file: str = Field(max_length=256)
    bbox_filter: Optional[str] = Field(default=None, max_length=128, description="필터 BBOX(lngMin,latMin,lngMax,latMax)")
    inserted_count: int = 0
    skipped_count: int = 0
    status: str = Field(default="ok", max_length=32)
    message: Optional[str] = Field(default=None, max_length=1024)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None


class ForestParcelSummary(SQLModel, table=True):
    """필지별 산림 분석 결과 캐시 — 파셀 ID × 레이어 조합으로 유니크.

    API 가 parcel_no + layer_type 를 받아 summary 계산 후 이곳에 저장.
    재요청 시 geom 변경 없으면 캐시 반환.
    """

    __tablename__ = "forest_parcel_summary"

    id: Optional[int] = Field(default=None, primary_key=True)
    parcel_no: int = Field(index=True, description="PARCELS.no 와 매칭")
    layer_type: str = Field(index=True, max_length=32)
    summary: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    computed_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        Index("ix_forest_summary_parcel_layer", "parcel_no", "layer_type", unique=True),
    )
