import asyncio
import os
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ..services.openclaw_ws import stream_chat, OpenClawError
from ..services import parcel_extractor as pe
from ..services import ollama_vision as ov
from ..core.config import get_settings

router = APIRouter(prefix="/api/ai", tags=["ai"])
settings = get_settings()


class Msg(BaseModel):
    role: str
    content: str


@router.websocket("/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_json()
            messages = raw.get("messages") or []
            model = raw.get("model") or settings.openclaw_model_default
            try:
                async for evt in stream_chat(model=model, messages=messages):
                    await ws.send_json(evt)
                    if evt.get("type") in ("done", "error"):
                        break
            except OpenClawError as e:
                await ws.send_json({"type": "error", "error": str(e), "fallback": True})
    except WebSocketDisconnect:
        return


MAX_UPLOAD = 10 * 1024 * 1024  # 10MB
_TABULAR = {".csv", ".xlsx", ".xlsm"}
_IMAGE = {".png", ".jpg", ".jpeg", ".webp"}

# 이미지/스캔PDF 비전 추출은 ~1-3분 → 프록시(Cloudflare/Orbitron) 타임아웃을 넘기므로
# 비동기 job 으로 처리하고 프론트가 폴링한다. 단일 워커 프로세스 메모리에 보관.
_JOBS: dict[str, dict] = {}
_JOBS_MAX = 64


def _new_job() -> str:
    # 오래된 완료 job 정리(메모리 누수 방지)
    if len(_JOBS) > _JOBS_MAX:
        for jid in [j for j, v in _JOBS.items() if v.get("status") != "processing"][: _JOBS_MAX // 2]:
            _JOBS.pop(jid, None)
    job_id = str(uuid.uuid4())
    _JOBS[job_id] = {"status": "processing"}
    return job_id


async def _vision_job(job_id: str, data: bytes, kind: str):
    """백그라운드 비전 추출. kind: 'image' | 'pdf'."""
    try:
        if kind == "pdf":
            png = pe.pdf_first_page_png(data)
            if png is None:
                _JOBS[job_id] = {"status": "done", "result": {
                    "prefix": None, "parcels": [], "source": "pdf",
                    "warnings": ["스캔 PDF — 변환 도구(poppler) 없음. 이미지로 변환해 업로드하세요"]}}
                return
            rows = await ov.extract_lots_from_image(png)
            _JOBS[job_id] = {"status": "done", "result": {
                "prefix": None, "parcels": rows, "source": "pdf-vision",
                "warnings": [] if rows else ["스캔 PDF 에서 지번을 찾지 못함"]}}
        else:
            rows = await ov.extract_lots_from_image(data)
            _JOBS[job_id] = {"status": "done", "result": {
                "prefix": None, "parcels": rows, "source": "vision",
                "warnings": [] if rows else ["이미지에서 지번을 찾지 못함"]}}
    except ov.OllamaVisionError as e:
        _JOBS[job_id] = {"status": "error", "detail": f"AI 비전 추출 실패: {e}"}
    except Exception as e:  # noqa: BLE001 — job 은 어떤 오류든 상태로 보고
        _JOBS[job_id] = {"status": "error", "detail": f"추출 오류: {e}"}


@router.post("/extract-parcels")
async def extract_parcels(file: UploadFile = File(...)):
    # 크기 제한을 초과하는 분량은 버퍼링하지 않도록 한도+1 까지만 읽음.
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="파일이 너무 큼 (최대 10MB)")
    ext = os.path.splitext(file.filename or "")[1].lower()

    try:
        # 빠른 경로(표/텍스트PDF) — 동기 반환
        if ext in _TABULAR:
            rows = pe.extract_tabular(data, ext.lstrip("."))
            return {"prefix": None, "parcels": rows, "source": "tabular", "warnings": []}

        if ext == ".pdf":
            rows, scanned = pe.extract_text_pdf(data)
            if not scanned:
                return {"prefix": None, "parcels": rows, "source": "pdf", "warnings": []}
            # 스캔 PDF → 비전(느림) → 비동기 job
            job_id = _new_job()
            asyncio.create_task(_vision_job(job_id, data, "pdf"))
            return JSONResponse({"job_id": job_id, "status": "processing"}, status_code=202)

        if ext in _IMAGE:
            # 이미지 비전(느림) → 비동기 job
            job_id = _new_job()
            asyncio.create_task(_vision_job(job_id, data, "image"))
            return JSONResponse({"job_id": job_id, "status": "processing"}, status_code=202)

        raise HTTPException(status_code=415, detail=f"지원하지 않는 파일 형식: {ext or '알수없음'}")
    except pe.ExtractError as e:
        return {"prefix": None, "parcels": [], "source": "error", "warnings": [str(e)]}


@router.get("/extract-parcels/jobs/{job_id}")
async def extract_job(job_id: str):
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없음(만료되었거나 잘못된 id)")
    if job["status"] == "processing":
        return {"status": "processing"}
    # 종료 상태는 한 번 읽고 정리
    _JOBS.pop(job_id, None)
    if job["status"] == "error":
        return {"status": "error", "detail": job.get("detail", "추출 실패")}
    return {"status": "done", **job["result"]}
