"""어드민: MCP 플러그인 카탈로그 - Claude 설정 파일 스캔 + fallback."""
from pathlib import Path
import json

from fastapi import APIRouter, Depends

from ...core.deps import require_admin
from ...models.user import User

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[4]

FALLBACK = [
    {"name": "context7", "desc": "공식 라이브러리 문서 조회", "status": "connected"},
    {"name": "supabase", "desc": "Supabase DB/Auth 관리", "status": "connected"},
    {"name": "twinverse", "desc": "Twinverse 백엔드 연결", "status": "connected"},
    {"name": "Asana", "desc": "Asana 작업 관리", "status": "connected"},
    {"name": "Canva", "desc": "Canva 디자인 편집", "status": "connected"},
    {"name": "Figma", "desc": "Figma 디자인 연동", "status": "connected"},
    {"name": "Gmail", "desc": "Gmail 이메일 조작", "status": "connected"},
    {"name": "Notion", "desc": "Notion 페이지 관리", "status": "connected"},
    {"name": "Google Calendar", "desc": "캘린더 이벤트", "status": "connected"},
    {"name": "Google Drive", "desc": "Drive 파일", "status": "connected"},
]


@router.get("/plugins")
def list_plugins(admin: User = Depends(require_admin)):
    config_paths = [
        Path.home() / ".claude" / "settings.json",
        PROJECT_ROOT / ".claude" / "settings.json",
        PROJECT_ROOT / ".claude" / "settings.local.json",
    ]
    servers: list[dict] = []
    for p in config_paths:
        if p.is_file():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
            mcp = data.get("mcpServers") or data.get("mcp_servers") or {}
            for name, cfg in mcp.items():
                servers.append({
                    "name": name,
                    "command": cfg.get("command", ""),
                    "args": cfg.get("args", []),
                    "source": p.name,
                })
    if not servers:
        return {"source": "fallback", "items": FALLBACK}
    return {"source": "scanned", "items": servers}
