from datetime import datetime, timedelta, timezone
from typing import Any
import secrets
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, status
from .config import get_settings

settings = get_settings()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_ORDER = {"guest": 0, "investor": 1, "admin": 2, "superadmin": 3}


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(pw, hashed)
    except Exception:
        return False


def can_access_role(user_role: str, required: str) -> bool:
    return ROLE_ORDER.get(user_role, -1) >= ROLE_ORDER.get(required, 99)


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(sub: str, uid: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    return _encode({
        "sub": sub,
        "uid": uid,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_access_ttl_min)).timestamp()),
    })


def create_refresh_token(sub: str, uid: int, jti: str | None = None) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    jti = jti or secrets.token_urlsafe(16)
    token = _encode({
        "sub": sub,
        "uid": uid,
        "type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_refresh_ttl_days)).timestamp()),
    })
    return token, jti


def create_reset_token(uid: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    return _encode({
        "sub": email,
        "uid": uid,
        "type": "reset",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.password_reset_ttl_min)).timestamp()),
    })


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {e}")
    if expected_type and claims.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong token type")
    return claims


class RefreshTokenStore:
    """In-memory 화이트리스트. 프로덕션에서는 Redis 또는 DB 로 대체."""

    def __init__(self) -> None:
        self._active: set[str] = set()

    def issue(self, jti: str) -> None:
        self._active.add(jti)

    def is_valid(self, jti: str) -> bool:
        return jti in self._active

    def revoke(self, jti: str) -> None:
        self._active.discard(jti)


refresh_store = RefreshTokenStore()


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    secure = settings.cookie_secure
    domain = settings.cookie_domain or None
    samesite = settings.cookie_samesite

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=domain,
        path="/",
        max_age=settings.jwt_access_ttl_min * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=domain,
        path="/api/auth",
        max_age=settings.jwt_refresh_ttl_days * 86400,
    )


def clear_auth_cookies(response) -> None:
    domain = settings.cookie_domain or None
    response.delete_cookie("access_token", path="/", domain=domain)
    response.delete_cookie("refresh_token", path="/api/auth", domain=domain)


def current_user_claims(token: str | None = None) -> dict[str, Any]:
    """Legacy 호환용. 새 코드는 app.core.deps.current_user 사용."""
    if not token:
        raise HTTPException(status_code=401, detail="missing token")
    return decode_token(token, expected_type="access")
