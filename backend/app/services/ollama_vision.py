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
    "이 이미지는 한국 토지 현황표/지적도/토지대장이다. 표의 각 데이터 행에서 다음을 정확히 추출하라:\n"
    "- location: 동/리 이름 (예: 금왕리). 따옴표(\")나 '〃' 같은 동일 표시는 바로 윗 행과 같은 값으로 채워라.\n"
    "- lot: 지번 (예: 104-1, 산31). 산(임야)은 '산' 접두사 유지.\n"
    "- category: 지목 (전·답·임야·대·도로·하천·구거·유지 등). 면적 칸 앞에 붙은 지목 글자.\n"
    "- area_m2: 면적 숫자만, ㎡ 기준. 콤마 제거. 예: '2,044m2'→2044, '도로 48m2'→48.\n"
    "- owner: 소유자 (있을 때만, 없으면 빈 문자열).\n"
    "보이지 않는 값은 빈 문자열 또는 0. 이미지에 없는 행을 지어내지 말고, '합계/계' 행은 제외하라.\n"
    '오직 JSON 배열로만 답하라: '
    '[{"location":"금왕리","lot":"104-1","category":"도로","area_m2":48,"owner":""}]. '
    "설명·코드펜스 없이 JSON 만."
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


def parse_parcels(content: str) -> list[dict]:
    """LLM 응답 텍스트 → [{location, lot, category, area_m2, owner}] (관대 파싱 + 정규화)."""
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
        out.append({
            "location": str(item.get("location", "")).strip(),
            "lot": lot,
            "category": str(item.get("category", "")).strip(),
            "area_m2": pe.parse_area_m2(item.get("area_m2")),
            "owner": str(item.get("owner", "")).strip(),
        })
    return out


# 하위 호환 별칭
parse_lots = parse_parcels


async def extract_lots_from_image(data: bytes) -> list[dict]:
    """이미지 → 필지(동/리·지번) 목록. Ollama 도달 불가/오류 시 OllamaVisionError."""
    b64 = downscale_to_jpeg_b64(data)
    payload = {
        "model": settings.ollama_vision_model,
        "messages": [{"role": "user", "content": VISION_PROMPT, "images": [b64]}],
        "stream": False,
        "options": {"temperature": 0},
    }
    timeout = httpx.Timeout(connect=10.0, read=settings.ollama_timeout, write=60.0, pool=settings.ollama_timeout)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.ollama_url}/api/chat", json=payload)
            r.raise_for_status()
            content = r.json().get("message", {}).get("content", "")
    except httpx.TimeoutException as e:
        raise OllamaVisionError(
            f"Ollama 응답 시간 초과({settings.ollama_timeout:.0f}s) — GPU 혼잡일 수 있어요. 잠시 후 다시 시도하세요"
        ) from e
    except (httpx.HTTPError, OSError) as e:
        raise OllamaVisionError(f"Ollama 호출 실패: {e}") from e
    return parse_parcels(content)
