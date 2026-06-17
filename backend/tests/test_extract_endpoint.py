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


def test_extract_image_async_job(client, monkeypatch):
    import time
    from app.services import ollama_vision as ov

    async def fake(data):
        return [{"location": "금왕리", "lot": "104-1"}, {"location": "금왕리", "lot": "104"}]

    monkeypatch.setattr(ov, "extract_lots_from_image", fake)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    r = client.post("/api/ai/extract-parcels", files={"file": ("t.png", png, "image/png")})
    assert r.status_code == 202
    job_id = r.json()["job_id"]
    body = {"status": "processing"}
    for _ in range(60):
        body = client.get(f"/api/ai/extract-parcels/jobs/{job_id}").json()
        if body["status"] != "processing":
            break
        time.sleep(0.05)
    assert body["status"] == "done"
    assert [p["lot"] for p in body["parcels"]] == ["104-1", "104"]
    assert body["source"] == "vision"


def test_extract_job_not_found(client):
    r = client.get("/api/ai/extract-parcels/jobs/nonexistent")
    assert r.status_code == 404
