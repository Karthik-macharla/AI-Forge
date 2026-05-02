"""JWT creation and get_current_user dependency."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

_ALGORITHM = "HS256"


class CurrentUser:
    """Lightweight JWT principal — not an ORM model."""

    def __init__(self, user_id: uuid.UUID, email: str) -> None:
        self.id = user_id
        self.email = email


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


async def get_current_user(
    access_token: str | None = Cookie(default=None),
) -> CurrentUser:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "unauthorized", "message": "Not authenticated"},
    )
    if not access_token:
        raise exc
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
        user_id: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        if not user_id or not email:
            raise exc
        return CurrentUser(user_id=uuid.UUID(user_id), email=email)
    except (JWTError, ValueError):
        raise exc
