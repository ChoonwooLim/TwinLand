"""Ollama 비전 — 이미지에서 필지(동/리·지번) 목록 추출.

twinverse-ai LAN Ollama(RTX 3090, gemma4:26b 멀티모달)를 직접 호출한다.
NO API KEYS — LAN·과금 0원. (OpenClaw 게이트웨이는 원격 비전 미지원이라 우회)

추출 정확도는 완벽하지 않다(소형 로컬 비전). 결과는 '초안 지번 목록'으로,
프론트의 VWorld 자동조회 + 사용자 검토로 권위 값을 채우는 설계를 전제한다.
"""
from __future__ import annotations

import base64
import io

import httpx

from ..core.config import get_settings
from . import parcel_extractor as pe

settings = get_settings()

VISION_PROMPT = (
    "이 이미지는 한국 지적도/지번 목록/토지대장이다. 실제로 보이는 필지의 "
    "동/리 이름과 지번만 정확히 추출하라. 지목·면적·소유자는 제외하고, "
    "이미지에 없는 번호를 지어내지 마라. 산(임야) 지번은 '산31'처럼 '산' 접두사를 유지하라. "
    '오직 JSON 배열로만 답하라: [{"location":"리이름","lot":"지번"}]. '
    "지번은 '384-18' 또는 '산31' 형식. 설명·코드펜스 없이 JSON 만."
)


class OllamaVisionError(RuntimeError):
    pass


def downscale_to_jpeg_b64(data: bytes, max_side: int | None = None, quality: int = 90) -> str:
    """이미지 바이트 → 다운스케일 JPEG base64 (속도/페이로드 절감)."""
    from PIL import Image

    max_side = max_side or settings.vision_max_side
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


def parse_lots(content: str) -> list[dict]:
    """LLM 응답 텍스트 → [{location, lot}] (관대 파싱 + 정규화)."""
    parsed = pe.lenient_json(content)
    if not isinstance(parsed, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for item in parsed:
        if not isinstance(item, dict):
            continue
        lot = pe.normalize_lot(str(item.get("lot", "")))
        if not lot or lot in seen:
            continue
        seen.add(lot)
        out.append({"location": str(item.get("location", "")).strip(), "lot": lot})
    return out


async def extract_lots_from_image(data: bytes) -> list[dict]:
    """이미지 → 필지(동/리·지번) 목록. Ollama 도달 불가/오류 시 OllamaVisionError."""
    b64 = downscale_to_jpeg_b64(data)
    payload = {
        "model": settings.ollama_vision_model,
        "messages": [{"role": "user", "content": VISION_PROMPT, "images": [b64]}],
        "stream": False,
        "options": {"temperature": 0},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            r = await client.post(f"{settings.ollama_url}/api/chat", json=payload)
            r.raise_for_status()
            content = r.json().get("message", {}).get("content", "")
    except (httpx.HTTPError, OSError) as e:
        raise OllamaVisionError(f"Ollama 비전 호출 실패: {e}") from e
    return parse_lots(content)
