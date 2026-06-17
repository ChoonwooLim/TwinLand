def test_extract_csv_returns_rows(client):
    files = {"file": ("parcels.csv", "지번\n384-18\n385\n", "text/csv")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 200
    body = r.json()
    assert [p["lot"] for p in body["parcels"]] == ["384-18", "385"]
    assert body["source"] == "tabular"

def test_extract_unsupported_type_415(client):
    files = {"file": ("a.txt", "hello", "text/plain")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 415

def test_extract_oversize_413(client):
    big = b"x" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.csv", big, "text/csv")}
    r = client.post("/api/ai/extract-parcels", files=files)
    assert r.status_code == 413
