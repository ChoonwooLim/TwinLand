"""어드민: Claude Code 스킬 카탈로그 - 로컬 프로젝트의 .claude/skills 디렉토리 스캔 + fallback."""
from pathlib import Path
import re

from fastapi import APIRouter, Depends

from ...core.deps import require_admin
from ...models.user import User

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[4]  # backend/app/routers/admin/skills.py → project root

FALLBACK = [
    {"name": "brainstorming", "desc": "기능/설계 브레인스토밍", "plugin": "superpowers"},
    {"name": "writing-plans", "desc": "구현 계획 문서 작성", "plugin": "superpowers"},
    {"name": "executing-plans", "desc": "구현 계획 실행", "plugin": "superpowers"},
    {"name": "test-driven-development", "desc": "TDD 워크플로우", "plugin": "superpowers"},
    {"name": "systematic-debugging", "desc": "체계적 디버깅", "plugin": "superpowers"},
    {"name": "verification-before-completion", "desc": "완료 전 검증", "plugin": "superpowers"},
    {"name": "frontend-design", "desc": "프론트엔드 디자인", "plugin": "frontend-design"},
    {"name": "code-review", "desc": "코드 리뷰", "plugin": "code-review"},
    {"name": "start", "desc": "세션 시작", "plugin": "user"},
    {"name": "end", "desc": "세션 종료", "plugin": "user"},
    {"name": "init", "desc": "프로젝트 초기화", "plugin": "user"},
    {"name": "polish", "desc": "최종 품질 패스", "plugin": "user"},
    {"name": "audit", "desc": "접근성/성능/품질 감사", "plugin": "user"},
    {"name": "critique", "desc": "UX 관점 디자인 크리틱", "plugin": "user"},
    {"name": "animate", "desc": "의도적 애니메이션 추가", "plugin": "user"},
]


def _scan_skills(base: Path) -> list[dict]:
    results: list[dict] = []
    if not base.exists():
        return results

    for md in base.rglob("SKILL.md"):
        try:
            text = md.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        name_m = re.search(r"^name:\s*(.+)$", text, re.MULTILINE)
        desc_m = re.search(r"^description:\s*(.+)$", text, re.MULTILINE)
        results.append({
            "name": (name_m.group(1).strip() if name_m else md.parent.name),
            "desc": (desc_m.group(1).strip()[:200] if desc_m else ""),
            "plugin": md.parent.parent.name if md.parent.parent.name != "skills" else "user",
            "path": str(md.relative_to(base)),
        })
    return results


@router.get("/skills")
def list_skills(admin: User = Depends(require_admin)):
    bases = [
        PROJECT_ROOT / ".claude" / "skills",
        PROJECT_ROOT / ".claude" / "plugins",
    ]
    scanned: list[dict] = []
    for b in bases:
        scanned.extend(_scan_skills(b))

    if not scanned:
        return {"source": "fallback", "items": FALLBACK}
    # dedupe by name
    seen = set()
    unique = []
    for s in scanned:
        if s["name"] in seen:
            continue
        seen.add(s["name"])
        unique.append(s)
    return {"source": "scanned", "items": unique}
