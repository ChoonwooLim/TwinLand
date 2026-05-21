from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from ..services.openclaw_ws import stream_chat, OpenClawError
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
