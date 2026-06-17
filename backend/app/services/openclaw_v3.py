"""OpenClaw v3 게이트웨이 클라이언트 (operator role, Ed25519 device auth).

참조 구현: C:/WORK/TwinverseAI/deskrpg-master/src/lib/openclaw-gateway.js
프로토콜 요약:
  - 프레임: {"type":"req"/"res"/"event", ...} (JSON-RPC 아님)
  - 핸드셰이크: 연결 시 서버가 event `connect.challenge`{nonce,ts} 전송
    → 클라이언트가 `connect` req 를 device 서명(Ed25519)과 함께 전송 → res ok
  - 채팅: `chat.send` req {sessionKey, message, idempotencyKey}
    → event `agent`(stream=assistant, data.delta) 누적 → event `chat`(state=final) 종료
  - device 신원은 클라이언트가 자체 생성(Ed25519). 게이트웨이 토큰으로 인가.

NO API KEYS — LAN 게이트웨이 + 플랜 토큰만 사용.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Any

import websockets
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from ..core.config import get_settings

settings = get_settings()

PROTOCOL = 3
CLIENT_ID = "cli"
CLIENT_MODE = "cli"
ROLE = "operator"
# agents.files.set(이미지 워크스페이스 업로드)가 operator.admin 을 요구하므로 포함.
# (게이트웨이의 기존 operator device 들도 동일하게 admin 보유)
SCOPES = ["operator.read", "operator.write", "operator.admin"]
ORIGIN = "http://localhost:18789"  # 게이트웨이 기본 allowedOrigins


class OpenClawError(RuntimeError):
    pass


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _load_or_create_identity(path: str) -> dict:
    p = Path(path)
    if p.is_file():
        try:
            d = json.loads(p.read_text())
            if d.get("id") and d.get("publicKey") and d.get("privateKeyPem"):
                return d
        except Exception:
            pass
    priv = Ed25519PrivateKey.generate()
    pub_raw = priv.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    identity = {
        "id": hashlib.sha256(pub_raw).hexdigest(),
        "publicKey": _b64url(pub_raw),
        "privateKeyPem": pem,
    }
    p.write_text(json.dumps(identity, indent=2))
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    return identity


def _build_device_auth(challenge: dict, token: str, identity: dict) -> dict:
    nonce = challenge.get("nonce")
    signed_at = challenge.get("ts")
    payload = "|".join([
        "v2", identity["id"], CLIENT_ID, CLIENT_MODE, ROLE,
        ",".join(SCOPES), str(signed_at), token or "", nonce,
    ])
    priv = serialization.load_pem_private_key(identity["privateKeyPem"].encode(), password=None)
    return {
        "id": identity["id"],
        "publicKey": identity["publicKey"],
        "signature": _b64url(priv.sign(payload.encode())),
        "signedAt": signed_at,
        "nonce": nonce,
    }


class OpenClawV3:
    def __init__(self, url: str | None = None, token: str | None = None):
        self._url = url or settings.openclaw_v3_ws_url
        self._token = token if token is not None else settings.openclaw_token
        self._identity = _load_or_create_identity(settings.openclaw_device_path)
        self._ws = None
        self._reader: asyncio.Task | None = None
        self._pending: dict[str, asyncio.Future] = {}
        self._chats: dict[str, dict] = {}          # sessionKey → {"buf": [], "future": Future}
        self._challenge: asyncio.Future | None = None

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *exc):
        await self.close()

    async def connect(self, timeout: float = 15.0):
        loop = asyncio.get_event_loop()
        self._challenge = loop.create_future()
        try:
            self._ws = await websockets.connect(
                self._url, origin=ORIGIN, max_size=2**24, open_timeout=10
            )
        except (OSError, websockets.exceptions.WebSocketException) as e:
            raise OpenClawError(f"게이트웨이 연결 실패: {e}") from e
        self._reader = asyncio.create_task(self._read_loop())
        try:
            challenge = await asyncio.wait_for(self._challenge, timeout=timeout)
        except asyncio.TimeoutError as e:
            await self.close()
            raise OpenClawError("connect.challenge 미수신") from e
        device = _build_device_auth(challenge, self._token, self._identity)
        params: dict[str, Any] = {
            "minProtocol": PROTOCOL,
            "maxProtocol": PROTOCOL,
            "client": {"id": CLIENT_ID, "version": "1.0.0", "platform": "python", "mode": CLIENT_MODE},
            "role": ROLE,
            "scopes": SCOPES,
            "device": device,
        }
        if self._token:
            params["auth"] = {"token": self._token}
        await self.rpc("connect", params, timeout=timeout)

    async def close(self):
        if self._reader:
            self._reader.cancel()
        if self._ws:
            await self._ws.close()
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(OpenClawError("연결 종료"))
        self._pending.clear()

    async def _read_loop(self):
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type")
                if t == "event":
                    self._on_event(msg)
                elif t == "res":
                    fut = self._pending.pop(msg.get("id"), None)
                    if fut and not fut.done():
                        if msg.get("ok"):
                            fut.set_result(msg.get("payload") or {})
                        else:
                            fut.set_exception(OpenClawError(json.dumps(msg.get("error"), ensure_ascii=False)))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(OpenClawError(f"reader 종료: {e}"))

    def _on_event(self, msg: dict):
        event = msg.get("event")
        payload = msg.get("payload") or {}
        if event == "connect.challenge":
            if self._challenge and not self._challenge.done():
                self._challenge.set_result(payload)
            return
        if event == "tick":
            return
        if event == "agent" and payload.get("stream") == "assistant":
            sk = payload.get("sessionKey")
            delta = (payload.get("data") or {}).get("delta")
            chat = self._chats.get(sk)
            if chat and delta:
                chat["buf"].append(delta)
            return
        if event == "chat":
            sk = payload.get("sessionKey")
            chat = self._chats.get(sk)
            if not chat:
                return
            state = payload.get("state")
            if state == "final":
                text = "".join(chat["buf"])
                if not text and payload.get("message", {}).get("content"):
                    text = "".join(
                        c.get("text", "") for c in payload["message"]["content"] if c.get("type") == "text"
                    )
                if not chat["future"].done():
                    chat["future"].set_result(text)
            elif state == "error":
                if not chat["future"].done():
                    chat["future"].set_exception(
                        OpenClawError(payload.get("error") or payload.get("errorMessage") or "chat error")
                    )

    async def rpc(self, method: str, params: dict, timeout: float = 30.0) -> dict:
        rid = str(uuid.uuid4())
        loop = asyncio.get_event_loop()
        fut = loop.create_future()
        self._pending[rid] = fut
        await self._ws.send(json.dumps({"type": "req", "id": rid, "method": method, "params": params}))
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError as e:
            self._pending.pop(rid, None)
            raise OpenClawError(f"rpc {method} timeout") from e

    async def agents_list(self) -> list[dict]:
        res = await self.rpc("agents.list", {})
        return res.get("agents", [])

    async def resolve_agent_id(self, name: str) -> str:
        agents = await self.agents_list()
        for a in agents:
            if a.get("id") == name or a.get("name") == name:
                return a.get("id")
        # 대소문자 무시 매칭
        low = name.lower()
        for a in agents:
            if str(a.get("name", "")).lower() == low:
                return a.get("id")
        raise OpenClawError(f"에이전트 '{name}' 없음. 가용: {[a.get('name') for a in agents]}")

    async def files_set(self, agent_id: str, name: str, content: str) -> dict:
        return await self.rpc("agents.files.set", {"agentId": agent_id, "name": name, "content": content})

    async def chat_send(self, agent_id: str, session: str, message: str, timeout: float = 180.0) -> str:
        sk = session if session.startswith("agent:") else f"agent:{agent_id}:{session}"
        loop = asyncio.get_event_loop()
        fut = loop.create_future()
        self._chats[sk] = {"buf": [], "future": fut}
        try:
            await self.rpc("chat.send", {"sessionKey": sk, "message": message, "idempotencyKey": str(uuid.uuid4())})
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError as e:
            raise OpenClawError("chat 응답 timeout") from e
        finally:
            self._chats.pop(sk, None)
