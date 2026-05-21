import json

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, Response

from ..core.config import get_settings

router = APIRouter(prefix="/api/vworld", tags=["vworld"])

VWORLD_BASE = "https://api.vworld.kr/req"


@router.get("/config.js", response_class=PlainTextResponse)
def vworld_config_js():
    s = get_settings()
    body = (
        f"window.VWORLD_KEY = {json.dumps(s.vworld_api_key or '')};\n"
        f"window.CESIUM_ION_TOKEN = {json.dumps(s.cesium_ion_token or '')};\n"
    )
    return Response(
        content=body,
        media_type="application/javascript; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


def _prepare_vworld_params(request: Request) -> dict:
    """키/도메인을 서버 측 설정으로 강제한다. VWorld 는 query 의 `domain` 이
    발급 시 등록한 서비스 URL 호스트명과 일치해야 하므로, 브라우저가 localhost
    등에서 호출하더라도 백엔드가 등록 도메인으로 덮어써야 INCORRECT_KEY 를 피한다.
    """
    s = get_settings()
    if not s.vworld_api_key:
        raise HTTPException(status_code=503, detail="VWORLD_API_KEY not configured")
    params = dict(request.query_params)
    params["key"] = s.vworld_api_key
    if s.vworld_registered_domain:
        params["domain"] = s.vworld_registered_domain
    return params


@router.get("/address")
async def vworld_address_proxy(request: Request):
    params = _prepare_vworld_params(request)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{VWORLD_BASE}/address", params=params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@router.get("/data")
async def vworld_data_proxy(request: Request):
    params = _prepare_vworld_params(request)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{VWORLD_BASE}/data", params=params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


# NED (Nationwide Essential Data) 서비스 — 토지특성/소유/공시지가 등 PNU 기반 조회
# 예: /api/vworld/ned/getLandCharacteristics?pnu=...&stdrYear=2024&format=json
@router.get("/ned/{endpoint}")
async def vworld_ned_proxy(endpoint: str, request: Request):
    params = _prepare_vworld_params(request)
    params.setdefault("format", "json")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"https://api.vworld.kr/ned/data/{endpoint}", params=params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))
