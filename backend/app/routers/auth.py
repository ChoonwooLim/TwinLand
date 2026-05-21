from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from ..core.config import get_settings
from ..core.db import get_session
from ..core.deps import current_user
from ..core.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_password,
    refresh_store,
    set_auth_cookies,
    verify_password,
)
from ..models.user import User
from ..services.email import send_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = None


class PasswordForgotIn(BaseModel):
    email: EmailStr


class PasswordResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChangeIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    display_name: str | None
    phone: str | None
    company: str | None
    is_active: bool


class TokenOut(BaseModel):
    ok: bool = True
    user: UserOut


def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        role=u.role,
        display_name=u.display_name,
        phone=u.phone,
        company=u.company,
        is_active=u.is_active,
    )


def _issue_session(response: Response, user: User) -> None:
    access = create_access_token(sub=user.email, uid=user.id, role=user.role)
    refresh, jti = create_refresh_token(sub=user.email, uid=user.id)
    refresh_store.issue(jti)
    set_auth_cookies(response, access, refresh)


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_session)):
    existing = db.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="guest",
        display_name=body.display_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _issue_session(response, user)

    try:
        send_email(db, user.email, "register_welcome", {
            "email": user.email,
            "display_name": user.display_name,
            "upgrade_url": f"{settings.frontend_url}/upgrade",
        })
    except Exception:
        pass

    return TokenOut(user=_user_to_out(user))


@router.post("/login", response_model=TokenOut)
def login(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session),
):
    user = db.exec(select(User).where(User.email == form.username)).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="account disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.add(user); db.commit(); db.refresh(user)

    _issue_session(response, user)
    return TokenOut(user=_user_to_out(user))


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
):
    if refresh_token:
        try:
            claims = decode_token(refresh_token, expected_type="refresh")
            jti = claims.get("jti")
            if jti:
                refresh_store.revoke(jti)
        except HTTPException:
            pass
    clear_auth_cookies(response)


@router.post("/refresh", response_model=TokenOut)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="missing refresh token")
    claims = decode_token(refresh_token, expected_type="refresh")
    jti = claims.get("jti")
    if not jti or not refresh_store.is_valid(jti):
        raise HTTPException(status_code=401, detail="refresh token invalidated")

    uid = claims.get("uid")
    user = db.get(User, int(uid)) if uid else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="user unavailable")

    refresh_store.revoke(jti)
    _issue_session(response, user)
    return TokenOut(user=_user_to_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return _user_to_out(user)


@router.post("/forgot-password", status_code=204)
def forgot_password(body: PasswordForgotIn, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == body.email)).first()
    if not user:
        return
    token = create_reset_token(uid=user.id, email=user.email)
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    send_email(db, user.email, "password_reset", {
        "email": user.email,
        "reset_url": reset_url,
        "ttl_min": settings.password_reset_ttl_min,
    })


@router.post("/reset-password", status_code=204)
def reset_password(body: PasswordResetIn, db: Session = Depends(get_session)):
    claims = decode_token(body.token, expected_type="reset")
    uid = claims.get("uid")
    user = db.get(User, int(uid)) if uid else None
    if not user:
        raise HTTPException(status_code=400, detail="invalid token")
    user.password_hash = hash_password(body.new_password)
    db.add(user); db.commit()


@router.post("/change-password", status_code=204)
def change_password(
    body: PasswordChangeIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_session),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="old password mismatch")
    user.password_hash = hash_password(body.new_password)
    db.add(user); db.commit()
