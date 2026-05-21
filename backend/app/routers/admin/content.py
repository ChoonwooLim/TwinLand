from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ...core.db import get_session
from ...core.deps import require_admin
from ...models.content_block import ContentBlock
from ...models.user import User

router = APIRouter()


class BlockIn(BaseModel):
    page: str
    slot: str
    key: str
    value_ko: str = ""
    value_en: str = ""
    order_idx: int = 0


class BlocksBulkIn(BaseModel):
    blocks: list[BlockIn]


@router.get("/content")
def list_blocks(
    page: str | None = None,
    slot: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    q = select(ContentBlock)
    if page:
        q = q.where(ContentBlock.page == page)
    if slot:
        q = q.where(ContentBlock.slot == slot)
    items = db.exec(q).all()
    items = sorted(items, key=lambda x: (x.page, x.slot, x.order_idx, x.key))
    return {"items": [i.model_dump() for i in items]}


@router.put("/content/bulk")
def bulk_upsert(
    body: BlocksBulkIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    updated: list[int] = []
    for b in body.blocks:
        existing = db.exec(
            select(ContentBlock).where(
                ContentBlock.page == b.page,
                ContentBlock.slot == b.slot,
                ContentBlock.key == b.key,
            )
        ).first()
        if existing:
            existing.value_ko = b.value_ko
            existing.value_en = b.value_en
            existing.order_idx = b.order_idx
            existing.updated_by = admin.id
            existing.updated_at = datetime.now(timezone.utc)
            db.add(existing)
            updated.append(existing.id)
        else:
            new = ContentBlock(
                page=b.page, slot=b.slot, key=b.key,
                value_ko=b.value_ko, value_en=b.value_en, order_idx=b.order_idx,
                updated_by=admin.id,
            )
            db.add(new)
            db.flush()
            updated.append(new.id)
    db.commit()
    return {"ok": True, "count": len(updated)}


@router.delete("/content/{block_id}", status_code=204)
def delete_block(
    block_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    b = db.get(ContentBlock, block_id)
    if not b:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(b); db.commit()
