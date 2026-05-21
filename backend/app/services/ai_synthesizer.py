"""OpenClaw 게이트웨이로 보고서 prose 합성.

입력: GIS 수집 데이터 + 첨부 PDF 텍스트들
출력: JSON-구조화된 분석 (강점/제약/권장방향/체크리스트/섹션별 prose)

OpenClaw 가 도달 불가하거나 응답이 깨지면 fallback 합성 (템플릿 기반) 으로 graceful.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from . import openclaw_ws

logger = logging.getLogger("twinland.ai_synthesizer")

SYSTEM_PROMPT = """You are a Korean land-analysis consultant generating a comprehensive parcel analysis report.

Output STRICT JSON only — no markdown fences, no commentary. Schema:
{
  "title": "보고서 제목 (최대 80자, 한국어)",
  "summary": "한 줄 핵심 요약 (최대 120자, 한국어)",
  "strengths": ["강점1", "강점2", ...],          // 3-6 항목
  "constraints": ["제약1", ...],                   // 3-6 항목
  "recommendations": ["권장방향1", ...],          // 3-5 항목
  "section_prose": {
    "regulation": "§5 규제·인허가 관점 prose (한국어, 200-400자)",
    "forestry": "§6 임업환경·활용 방향 prose (200-400자)"
  },
  "checklist": {
    "rights_boundary": ["체크항목1", ...],        // 3-5 항목 — 권리·경계
    "permits_technical": ["체크항목1", ...]       // 3-5 항목 — 인허가·기술
  }
}

Be concrete, reference actual numbers (면적, 경사, 공시지가) when given. Korean only."""


def _format_user_prompt(
    parcels: list[dict[str, Any]],
    summary: dict[str, Any],
    attachments_text: list[dict[str, str]],
) -> str:
    parts: list[str] = []
    parts.append("# 필지 데이터")
    parts.append(json.dumps({"parcels": parcels, "summary": summary}, ensure_ascii=False, indent=2)[:8000])
    if attachments_text:
        parts.append("\n# 사용자 업로드 PDF 발췌")
        for att in attachments_text:
            parts.append(f"\n## {att['type']}: {att['name']}")
            parts.append(att["text"][:6000])
    parts.append("\n# 작업\n위 데이터를 종합해 위 JSON 스키마로 출력하라. JSON 외 다른 텍스트 금지.")
    return "\n".join(parts)


async def _call_openclaw(user_prompt: str, agent: str | None, model: str | None) -> str:
    """OpenClaw stream 으로 호출 → 전체 텍스트 합산 반환."""
    chunks: list[str] = []
    async for evt in openclaw_ws.stream_chat(
        agent=agent,
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    ):
        t = evt.get("type")
        if t == "delta":
            chunks.append(evt.get("text", ""))
        elif t == "error":
            raise openclaw_ws.OpenClawError(evt.get("message", "unknown openclaw error"))
        elif t == "done":
            break
    return "".join(chunks).strip()


def _parse_or_fallback(raw: str) -> dict[str, Any]:
    """LLM 출력에서 JSON 파싱 시도. 실패 시 코드펜스 벗기고 재시도."""
    text = raw.strip()
    if text.startswith("```"):
        # ```json ... ``` 제거
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    # 마지막 시도: 첫 { 부터 마지막 } 까지
    s = raw.find("{")
    e = raw.rfind("}")
    if s != -1 and e != -1 and e > s:
        try:
            return json.loads(raw[s:e+1])
        except Exception as exc:
            logger.warning("AI JSON parse failed: %s", exc)
    return {}


def _fallback_synthesis(parcels: list[dict[str, Any]], summary: dict[str, Any]) -> dict[str, Any]:
    """OpenClaw 실패 시 — 데이터만으로 기본 분석 합성."""
    forest_m2 = summary.get("area_by_category_m2", {}).get("임야", 0)
    total = summary.get("total_area_m2", 0) or 1
    forest_ratio = round(forest_m2 / total * 100, 1)
    parcel_count = summary.get("parcel_count", len(parcels))
    return {
        "title": f"{parcels[0].get('location') or '대상'} 필지 종합 분석 보고서 ({parcel_count}필지)",
        "summary": f"총 {summary.get('total_area_ha', 0)}ha · 임야 비율 {forest_ratio}%",
        "strengths": [
            f"총 {parcel_count}필지, {summary.get('total_area_ha', 0)}ha 의 단지화 가능한 규모",
            f"임야 비중 {forest_ratio}% — 산림·산양삼 등 임산물 활용 잠재력",
            "VWorld 지적·산림청 SHP 데이터로 정량 분석 가능한 부지",
        ],
        "constraints": [
            "현장 경계 측량·실측 필요 (지적도 vs 실 경계 차이 가능)",
            "AI 합성 미완 — 상세 prose 는 OpenClaw 게이트웨이 활성 후 재생성",
        ],
        "recommendations": [
            "VWorld 토지이용계획서 + 산림청 산지구분도 교차 확인",
            "경사 25° 초과 면적 비율로 산지전용 인허가 난이도 사전 평가",
        ],
        "section_prose": {
            "regulation": "(AI 합성 미완) 각 필지의 용도지역·산지구분·중첩 규제를 토지이용계획 및 산지정보조회 자료로 개별 확인 필요.",
            "forestry": "(AI 합성 미완) 임상도·울폐도·표고 데이터를 기반으로 수종 적합성 및 산양삼·신갈나무 조림 가능성 검토 권장.",
        },
        "checklist": {
            "rights_boundary": [
                "등기부등본 소유관계 확인",
                "지적도 vs 실 경계 측량",
                "지역권·임차권 등 부담 확인",
            ],
            "permits_technical": [
                "산지전용 허가 가능성 사전 확인",
                "경사·지반·배수 토목 검토",
                "환경영향평가 대상 여부 확인",
            ],
        },
        "_fallback": True,
    }


async def synthesize_async(
    parcels: list[dict[str, Any]],
    summary: dict[str, Any],
    attachments_text: list[dict[str, str]] | None = None,
    *,
    agent: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """비동기 합성 — 실패 시 fallback 합성을 반환."""
    user_prompt = _format_user_prompt(parcels, summary, attachments_text or [])
    try:
        raw = await asyncio.wait_for(_call_openclaw(user_prompt, agent, model), timeout=90.0)
    except (openclaw_ws.OpenClawError, asyncio.TimeoutError) as e:
        logger.warning("OpenClaw 호출 실패 → fallback 합성: %s", e)
        result = _fallback_synthesis(parcels, summary)
        result["_error"] = str(e)
        return result

    parsed = _parse_or_fallback(raw)
    if not parsed or "strengths" not in parsed:
        logger.warning("AI 응답 파싱 실패 → fallback. 원본 앞부분: %s", raw[:200])
        result = _fallback_synthesis(parcels, summary)
        result["_error"] = "AI JSON 파싱 실패"
        result["_raw_preview"] = raw[:500]
        return result
    return parsed


def synthesize(
    parcels: list[dict[str, Any]],
    summary: dict[str, Any],
    attachments_text: list[dict[str, str]] | None = None,
    *,
    agent: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """동기 wrapper — FastAPI 동기 라우터에서 직접 호출 가능."""
    return asyncio.run(synthesize_async(parcels, summary, attachments_text, agent=agent, model=model))
