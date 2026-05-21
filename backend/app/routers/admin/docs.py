"""어드민: 프로젝트 문서(docs/) 트리 + 내용 조회."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ...core.deps import require_admin
from ...models.user import User

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[4]
DOCS_ROOT = PROJECT_ROOT / "docs"


def _safe(p: Path) -> bool:
    try:
        p.resolve().relative_to(DOCS_ROOT.resolve())
        return True
    except ValueError:
        return False


@router.get("/docs")
def list_docs(admin: User = Depends(require_admin)):
    if not DOCS_ROOT.is_dir():
        return {"items": []}
    items = []
    for p in sorted(DOCS_ROOT.rglob("*.md")):
        rel = p.relative_to(DOCS_ROOT).as_posix()
        items.append({
            "path": rel,
            "size": p.stat().st_size,
            "mtime": p.stat().st_mtime,
        })
    return {"root": str(DOCS_ROOT), "items": items}


@router.get("/docs/content")
def get_doc(
    path: str,
    admin: User = Depends(require_admin),
):
    target = (DOCS_ROOT / path).resolve()
    if not _safe(target):
        raise HTTPException(status_code=400, detail="invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return {
        "path": path,
        "content": target.read_text(encoding="utf-8", errors="ignore"),
    }
