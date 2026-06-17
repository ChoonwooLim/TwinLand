"""Phase 0 스파이크 — OpenClaw 멀티모달(이미지) 지원 검증.
실행: cd backend && .venv/Scripts/python -m scripts.spike_openclaw_vision <image_path>
목적: agent.chat 에 이미지 content block 을 보냈을 때 (1) 에러 없이 응답하는지,
      (2) 응답 envelope/델타 포맷이 무엇인지 기록. 결과를 설계서 부록에 메모.
NO API KEYS — OpenClaw LAN 게이트웨이만 사용.
"""
import asyncio
import base64
import json
import sys
import uuid

import websockets

from app.core.config import get_settings

settings = get_settings()


def anthropic_content(image_b64, media_type):
    return [
        {"type": "text", "text": "이 이미지에 보이는 텍스트를 한 줄로 요약해줘."},
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
    ]


def openai_content(image_b64, media_type):
    return [
        {"type": "text", "text": "이 이미지에 보이는 텍스트를 한 줄로 요약해줘."},
        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
    ]


async def try_envelope(label, content_builder, image_b64, media_type):
    req = {
        "jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "agent.chat",
        "params": {
            "agent": settings.openclaw_agent_pet,
            "model": getattr(settings, "openclaw_model_vision", settings.openclaw_model_default),
            "messages": [{"role": "user", "content": content_builder(image_b64, media_type)}],
            "stream": True,
        },
    }
    print(f"\n=== {label} ===")
    try:
        async with websockets.connect(settings.openclaw_ws_url, max_size=2**24, open_timeout=10) as ws:
            await ws.send(json.dumps(req))
            for _ in range(80):
                raw = await asyncio.wait_for(ws.recv(), timeout=45)
                evt = json.loads(raw)
                print("EVT:", json.dumps(evt, ensure_ascii=False)[:400])
                if evt.get("type") in ("done", "error") or evt.get("final"):
                    break
    except Exception as e:
        print(f"{label} FAILED: {type(e).__name__}: {e}")


async def main(path):
    media_type = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()
    print(f"image bytes(b64 len)={len(image_b64)} media={media_type} ws={settings.openclaw_ws_url}")
    await try_envelope("후보 A (anthropic)", anthropic_content, image_b64, media_type)
    await try_envelope("후보 B (openai)", openai_content, image_b64, media_type)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
