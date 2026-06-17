from app.services import parcel_extractor as pe

def test_normalize_lot_strips_and_fixes_san():
    assert pe.normalize_lot("  384-18 ") == "384-18"
    assert pe.normalize_lot("산 31") == "산31"
    assert pe.normalize_lot("산31-1") == "산31-1"

def test_normalize_lot_fullwidth_digits():
    assert pe.normalize_lot("３８４－１８") == "384-18"

def test_lenient_json_strips_code_fence():
    raw = '```json\n[{"location":"상교리","lot":"385"}]\n```'
    assert pe.lenient_json(raw) == [{"location": "상교리", "lot": "385"}]

def test_lenient_json_slices_array():
    raw = '설명입니다 [{"lot":"452"}] 끝.'
    assert pe.lenient_json(raw) == [{"lot": "452"}]

def test_lenient_json_returns_none_on_garbage():
    assert pe.lenient_json("완전히 깨진 텍스트") is None

def test_extract_tabular_csv_maps_headers():
    csv_bytes = "동리,지번,지목\n상교리,384-18,임야\n상교리,385,전\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "상교리", "lot": "384-18", "category": "임야", "area_m2": 0.0, "owner": ""},
        {"location": "상교리", "lot": "385", "category": "전", "area_m2": 0.0, "owner": ""},
    ]

def test_extract_tabular_full_attrs():
    csv_bytes = "소재지,지번,지목,면적,소유자\n금왕리,104-1,도로,48,홍길동\n금왕리,38,전,\"2,044\",\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "금왕리", "lot": "104-1", "category": "도로", "area_m2": 48.0, "owner": "홍길동"},
        {"location": "금왕리", "lot": "38", "category": "전", "area_m2": 2044.0, "owner": ""},
    ]

def test_extract_tabular_combined_cat_area_cell():
    # 면적 칸에 '도로 48m2' 처럼 지목+면적이 합쳐진 경우 분리
    csv_bytes = "지번,면적\n104-1,도로 48m2\n38,답 289m2\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows[0]["category"] == "도로" and rows[0]["area_m2"] == 48.0
    assert rows[1]["category"] == "답" and rows[1]["area_m2"] == 289.0

def test_parse_area_m2():
    assert pe.parse_area_m2("2,044m2") == 2044.0
    assert pe.parse_area_m2("48㎡") == 48.0
    assert pe.parse_area_m2(593) == 593.0
    assert pe.parse_area_m2("없음") == 0.0

def test_extract_tabular_csv_lot_only():
    csv_bytes = "번지\n452-1\n산29\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "", "lot": "452-1", "category": "", "area_m2": 0.0, "owner": ""},
        {"location": "", "lot": "산29", "category": "", "area_m2": 0.0, "owner": ""},
    ]

def test_extract_tabular_csv_skips_blank_lot():
    csv_bytes = "지번\n385\n\n  \n452\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert [r["lot"] for r in rows] == ["385", "452"]

def test_extract_tabular_no_lot_header_raises():
    csv_bytes = "이름,주소\n홍길동,서울\n".encode("utf-8")
    try:
        pe.extract_tabular(csv_bytes, "csv")
        assert False, "should raise"
    except pe.ExtractError:
        pass

def test_extract_lots_from_text_finds_jibun():
    text = "1번 상교리 384-18 임야\n2번 385 전\n비고: 산31-1 포함"
    rows = pe.extract_lots_from_text(text)
    assert {"location": "", "lot": "384-18"} in rows
    assert {"location": "", "lot": "385"} in rows
    assert {"location": "", "lot": "산31-1"} in rows

def test_extract_lots_from_text_dedup():
    text = "385 385 385"
    rows = pe.extract_lots_from_text(text)
    assert [r["lot"] for r in rows] == ["385"]


# === ollama_vision.parse_parcels (네트워크 없음) ===
from app.services import ollama_vision as ov


def test_ov_parse_parcels_full_fields():
    raw = '```json\n[{"location":"금왕리","lot":"104-1","category":"도로","area_m2":"48","owner":""},{"location":"금왕리","lot":"38","category":"전","area_m2":"2,044","owner":"홍길동"}]\n```'
    assert ov.parse_parcels(raw) == [
        {"location": "금왕리", "lot": "104-1", "category": "도로", "area_m2": 48.0, "owner": ""},
        {"location": "금왕리", "lot": "38", "category": "전", "area_m2": 2044.0, "owner": "홍길동"},
    ]


def test_ov_parse_parcels_dedup_and_skip_blank():
    raw = '[{"lot":"385"},{"lot":"385"},{"lot":""},{"location":"리","lot":"452"}]'
    assert ov.parse_parcels(raw) == [
        {"location": "", "lot": "385", "category": "", "area_m2": 0.0, "owner": ""},
        {"location": "리", "lot": "452", "category": "", "area_m2": 0.0, "owner": ""},
    ]


def test_ov_parse_parcels_garbage_returns_empty():
    assert ov.parse_parcels("죄송하지만 추출할 수 없습니다") == []
