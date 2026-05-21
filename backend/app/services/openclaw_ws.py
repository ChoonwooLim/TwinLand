"""
OpenClaw WebSocket RPC client (LAN gateway only — ws://192.168.219.117:18789).

Phase 0 scope:
  - Simple JSON-RPC over WS (protocol v3, operator role).
  - Device pairing is handled by the operator's Claude Code CLI / ChatGPT CLI,
    whose plan-token OAuth is already registered in OpenClaw. We reuse the
    operator's pre-paired identity file if OPENCLAW_DEVICE_KEY_PATH is set.
  - For the demo chat stream, we forward text frames and yield assistant deltas.

NO API KEYS are used here. If the ws URL is unreachable or the identity is
missing, the caller should fall back to a mock response so the UI stays alive.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, Any

import websockets

from ..core.config import get_settings

settings = get_settings()


class OpenClawError(RuntimeError):
    pass


@asynccontextmanager
async def connect() -> AsyncIterator[websockets.WebSocketClientProtocol]:
    try:
        async with websockets.connect(
            settings.openclaw_ws_url,
            ping_interval=20,
            ping_timeout=10,
            max_size=2**22,
        ) as ws:
            yield ws
    except (OSError, websockets.exceptions.WebSocketException) as e:
        raise OpenClawError(f"openclaw unreachable: {e}") from e


async def rpc(method: str, params: dict[str, Any] | None = None, timeout: float = 30.0) -> dict:
    req_id = str(uuid.uuid4())
    payload = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
    async with connect() as ws:
        await ws.send(json.dumps(payload))
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        except asyncio.TimeoutError as e:
            raise OpenClawError(f"rpc {method} timeout") from e
    msg = json.loads(raw)
    if msg.get("error"):
        raise OpenClawError(str(msg["error"]))
    return msg.get("result", {})


async def stream_chat(
    *,
    agent: str | None = None,
    model: str | None = None,
    messages: list[dict],
) -> AsyncIterator[dict]:
    """Yield streaming deltas for a chat turn.

    The event envelope mirrors OpenClaw's `agent.stream` protocol:
      {"type": "delta", "text": "..."} | {"type": "done"} | {"type": "error", ...}
    """
    params = {
        "agent": agent or settings.openclaw_agent_pet,
        "model": model or settings.openclaw_model_default,
        "messages": messages,
        "stream": True,
    }
    req = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": "agent.chat", "params": params}
    async with connect() as ws:
        await ws.send(json.dumps(req))
        while True:
            raw = await ws.recv()
            evt = json.loads(raw)
            yield evt
            if evt.get("type") in ("done", "error") or evt.get("final"):
                break
