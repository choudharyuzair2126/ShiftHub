import secrets
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from .config import get_settings

settings = get_settings()

# bcrypt has a hard 72-byte limit on passwords. We truncate safely to
# prevent ValueError on very long passwords (users can still use long ones).
_BCRYPT_MAX_BYTES = 72


def _to_bytes(password: str) -> bytes:
    """Encode and safely truncate to bcrypt's 72-byte limit."""
    b = password.encode("utf-8")
    return b[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt (with salt)."""
    hashed = bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(_to_bytes(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None


def new_token() -> str:
    return secrets.token_urlsafe(32)