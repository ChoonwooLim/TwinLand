"""Phase 0 스파이크 — OpenClaw 멀티모달(이미지) 지원 검증.
실행:
  cd backend && .venv/Scripts/python -m scripts.spike_openclaw_vision text   # 텍스트 프로브
  cd backend && .venv/Scripts/python -m scripts.spike_openclaw_vision image <path>  # 이미지 프로브
환경변수로 override: SPIKE_WS, SPIKE_AGENT, SPIKE_MODEL
목적: agent.chat 에 (1) 텍스트, (2) 이미지 content block 을 보냈을 때 응답 envelope/델타
      포맷을 기록. 결과를 설계서 부록에 메모.
NO API KEYS — OpenClaw LAN 게이트웨이만 사용.
"""
import asyncio
import base64
import json
import os
import sys
import uuid

import websockets

from app.core.config import get_settings

settings = get_settings()

WS = os.environ.get("SPIKE_WS", "ws://192.168.219.117:18790")
AGENT = os.environ.get("SPIKE_AGENT", "Orbi")
MODEL = os.environ.get("SPIKE_MODEL", "claude-cli/opus4.8")


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


async def send_and_dump(label, messages):
    req = {
        "jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "agent.chat",
        "params": {"agent": AGENT, "model": MODEL, "messages": messages, "stream": True},
    }
    print(f"\n=== {label} (agent={AGENT} model={MODEL} ws={WS}) ===")
    try:
        async with websockets.connect(WS, max_size=2**24, open_timeout=10) as ws:
            await ws.send(json.dumps(req))
            for _ in range(120):
                raw = await asyncio.wait_for(ws.recv(), timeout=60)
                evt = json.loads(raw)
                print("EVT:", json.dumps(evt, ensure_ascii=False)[:400])
                if evt.get("type") in ("done", "error") or evt.get("final"):
                    break
    except Exception as e:
        print(f"{label} FAILED: {type(e).__name__}: {e}")


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "text"
    if mode == "text":
        await send_and_dump("텍스트 프로브", [{"role": "user", "content": "ping. 한 단어로 답해."}])
        # content 가 배열(블록)도 텍스트만으로 먹히는지
        await send_and_dump("텍스트 블록 프로브",
                            [{"role": "user", "content": [{"type": "text", "text": "ping. 한 단어로 답해."}]}])
    else:
        path = sys.argv[2]
        media_type = "image/png" if path.lower().endswith(".png") else "image/jpeg"
        with open(path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()
        print(f"image b64 len={len(image_b64)} media={media_type}")
        await send_and_dump("후보 A (anthropic)",
                            [{"role": "user", "content": anthropic_content(image_b64, media_type)}])
        await send_and_dump("후보 B (openai)",
                            [{"role": "user", "content": openai_content(image_b64, media_type)}])


if __name__ == "__main__":
    asyncio.run(main())
