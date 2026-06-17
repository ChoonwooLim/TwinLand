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
