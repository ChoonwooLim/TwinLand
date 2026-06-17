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
        {"location": "상교리", "lot": "384-18"},
        {"location": "상교리", "lot": "385"},
    ]

def test_extract_tabular_csv_lot_only():
    csv_bytes = "번지\n452-1\n산29\n".encode("utf-8")
    rows = pe.extract_tabular(csv_bytes, "csv")
    assert rows == [
        {"location": "", "lot": "452-1"},
        {"location": "", "lot": "산29"},
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
