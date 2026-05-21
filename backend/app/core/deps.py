from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session, select

from .db import get_session
from .security import decode_token, can_access_role
from ..models.user import User


def current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing access token")
    claims = decode_token(access_token, expected_type="access")
    uid = claims.get("uid")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token claims")
    user = db.get(User, int(uid))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user inactive or deleted")
    return user


def _require(required_role: str):
    def _dep(user: User = Depends(current_user)) -> User:
        if not can_access_role(user.role, required_role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"requires {required_role}")
        return user
    return _dep


require_investor = _require("investor")
require_admin = _require("admin")
require_superadmin = _require("superadmin")


def optional_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
) -> User | None:
    if not access_token:
        return None
    try:
        claims = decode_token(access_token, expected_type="access")
    except HTTPException:
        return None
    uid = claims.get("uid")
    if not uid:
        return None
    user = db.get(User, int(uid))
    return user if user and user.is_active else None
