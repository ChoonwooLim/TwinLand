import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..core.config import get_settings
from ..core.db import get_session
from ..core.deps import current_user, require_admin
from ..core.security import can_access_role
from ..models.dataroom_doc import DataRoomDoc
from ..models.download_log import DownloadLog
from ..models.user import User

router = APIRouter(prefix="/api/dataroom", tags=["dataroom"])
settings = get_settings()

ALLOWED_EXT = {".pdf", ".xlsx", ".xls", ".docx", ".doc", ".zip", ".png", ".jpg", ".jpeg", ".mp4", ".pptx"}


def _upload_root() -> Path:
    root = Path(settings.upload_dir) / "dataroom"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _slugify(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")[:80] or "file"


def _doc_accessible(doc: DataRoomDoc, user: User) -> bool:
    if doc.access_level == "public":
        return True
    if doc.access_level == "investor":
        return can_access_role(user.role, "investor")
    if doc.access_level == "admin":
        return can_access_role(user.role, "admin")
    return False


class DocOut(BaseModel):
    id: int
    title: str
    file_type: str
    size_bytes: int | None
    access_level: str
    version: int
    description: str | None
    created_at: datetime
    updated_at: datetime


def _doc_to_out(d: DataRoomDoc) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "file_type": d.file_type,
        "size_bytes": d.size_bytes,
        "access_level": d.access_level,
        "version": d.version,
        "description": d.description,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


@router.get("")
def list_docs(user: User = Depends(current_user), db: Session = Depends(get_session)):
    all_docs = db.exec(select(DataRoomDoc)).all()
    visible = [d for d in all_docs if _doc_accessible(d, user)]
    visible = sorted(visible, key=lambda x: x.created_at, reverse=True)
    return {"items": [_doc_to_out(d) for d in visible]}


@router.get("/{doc_id}/download")
def download(
    doc_id: int,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_session),
):
    doc = db.get(DataRoomDoc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    if not _doc_accessible(doc, user):
        raise HTTPException(status_code=403, detail="forbidden")
    if not doc.path:
        raise HTTPException(status_code=404, detail="file missing")

    file_path = Path(settings.upload_dir) / doc.path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="file not on disk")

    db.add(DownloadLog(
        user_id=user.id,
        doc_id=doc.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ))
    db.commit()

    return FileResponse(
        path=str(file_path),
        filename=f"{_slugify(doc.title)}.{doc.file_type}",
        media_type="application/octet-stream",
    )


# ── admin ──

@router.post("/admin/upload", status_code=201)
async def upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    access_level: str = Form("investor"),
    description: str | None = Form(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    if access_level not in ("public", "investor", "admin"):
        raise HTTPException(status_code=400, detail="invalid access_level")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"extension {ext} not allowed")

    root = _upload_root()
    stored_name = f"{uuid.uuid4().hex}_{_slugify(Path(file.filename or 'file').stem)}{ext}"
    dest = root / stored_name

    size = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.max_upload_mb * 1024 * 1024:
                out.close()
                os.unlink(dest)
                raise HTTPException(status_code=413, detail="file too large")
            out.write(chunk)

    doc = DataRoomDoc(
        title=title,
        file_type=ext.lstrip("."),
        size_bytes=size,
        path=f"dataroom/{stored_name}",
        access_level=access_level,
        description=description,
        uploaded_by=admin.id,
        version=1,
    )
    db.add(doc); db.commit(); db.refresh(doc)
    return _doc_to_out(doc)


class DocUpdateIn(BaseModel):
    title: str | None = None
    access_level: str | None = None
    description: str | None = None


@router.put("/admin/{doc_id}")
def update_doc(
    doc_id: int,
    body: DocUpdateIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    doc = db.get(DataRoomDoc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    if body.title is not None:
        doc.title = body.title
    if body.access_level is not None:
        if body.access_level not in ("public", "investor", "admin"):
            raise HTTPException(status_code=400, detail="invalid access_level")
        doc.access_level = body.access_level
    if body.description is not None:
        doc.description = body.description
    doc.updated_at = datetime.now(timezone.utc)
    db.add(doc); db.commit(); db.refresh(doc)
    return _doc_to_out(doc)


@router.delete("/admin/{doc_id}", status_code=204)
def delete_doc(
    doc_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    doc = db.get(DataRoomDoc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    if doc.path:
        file_path = Path(settings.upload_dir) / doc.path
        if file_path.is_file():
            try:
                os.unlink(file_path)
            except OSError:
                pass
    db.delete(doc); db.commit()


@router.get("/admin/downloads")
def download_logs(
    doc_id: int | None = None,
    user_id: int | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(DownloadLog)
    if doc_id is not None:
        q = q.where(DownloadLog.doc_id == doc_id)
    if user_id is not None:
        q = q.where(DownloadLog.user_id == user_id)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: x.created_at, reverse=True)
    return {"items": [i.model_dump() for i in items[:500]]}
