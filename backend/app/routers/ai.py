import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
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


@router.post("/extract-parcels")
async def extract_parcels(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="파일이 너무 큼 (최대 10MB)")
    ext = os.path.splitext(file.filename or "")[1].lower()
    warnings: list[str] = []

    try:
        if ext in _TABULAR:
            rows = pe.extract_tabular(data, ext.lstrip("."))
            return {"prefix": None, "parcels": rows, "source": "tabular", "warnings": warnings}

        if ext == ".pdf":
            rows, scanned = pe.extract_text_pdf(data)
            if scanned:
                # 스캔 PDF: 첫 페이지를 이미지로 변환해 비전 추출 (poppler 없으면 안내).
                png = pe.pdf_first_page_png(data)
                if png is None:
                    return {"prefix": None, "parcels": [], "source": "pdf",
                            "warnings": ["스캔 PDF — 변환 도구(poppler) 없음. 이미지로 변환해 업로드하세요"]}
                try:
                    rows = await ov.extract_lots_from_image(png)
                except ov.OllamaVisionError as e:
                    raise HTTPException(status_code=502, detail=f"AI 비전 추출 실패: {e}")
                return {"prefix": None, "parcels": rows, "source": "pdf-vision",
                        "warnings": [] if rows else ["스캔 PDF 에서 지번을 찾지 못함"]}
            return {"prefix": None, "parcels": rows, "source": "pdf", "warnings": warnings}

        if ext in _IMAGE:
            try:
                rows = await ov.extract_lots_from_image(data)
            except ov.OllamaVisionError as e:
                raise HTTPException(status_code=502, detail=f"AI 비전 추출 실패: {e}")
            if not rows:
                warnings.append("이미지에서 지번을 찾지 못함")
            return {"prefix": None, "parcels": rows, "source": "vision", "warnings": warnings}

        raise HTTPException(status_code=415, detail=f"지원하지 않는 파일 형식: {ext or '알수없음'}")
    except pe.ExtractError as e:
        return {"prefix": None, "parcels": [], "source": "error", "warnings": [str(e)]}
