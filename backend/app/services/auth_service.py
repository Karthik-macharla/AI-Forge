"""Auth service — user creation, lookup, and password verification via Supabase HTTP API."""
import uuid
from dataclasses import dataclass
from datetime import datetime

import bcrypt

from app.db.supabase_client import get_supabase


@dataclass
class User:
    id: uuid.UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    hashed_password: str | None
    google_id: str | None
    created_at: datetime

    @classmethod
    def from_row(cls, row: dict) -> "User":
        return cls(
            id=uuid.UUID(row["id"]),
            email=row["email"],
            display_name=row.get("display_name"),
            avatar_url=row.get("avatar_url"),
            hashed_password=row.get("hashed_password"),
            google_id=row.get("google_id"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        )


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def get_by_email(email: str) -> User | None:
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("email", email).execute()
    if res.data:
        return User.from_row(res.data[0])
    return None


def get_by_id(user_id: uuid.UUID) -> User | None:
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("id", str(user_id)).execute()
    if res.data:
        return User.from_row(res.data[0])
    return None


def register(
    email: str,
    password: str,
    display_name: str | None = None,
) -> User:
    sb = get_supabase()
    row = {
        "id": str(uuid.uuid4()),
        "email": email,
        "display_name": display_name,
        "hashed_password": _hash(password),
    }
    res = sb.table("profiles").insert(row).execute()
    return User.from_row(res.data[0])


def create_google_user(
    email: str,
    google_id: str,
    display_name: str | None,
    avatar_url: str | None,
) -> User:
    sb = get_supabase()
    row = {
        "id": str(uuid.uuid4()),
        "email": email,
        "google_id": google_id,
        "display_name": display_name,
        "avatar_url": avatar_url,
    }
    res = sb.table("profiles").insert(row).execute()
    return User.from_row(res.data[0])


def authenticate(email: str, password: str) -> User | None:
    user = get_by_email(email)
    if not user or not user.hashed_password:
        return None
    if not _verify(password, user.hashed_password):
        return None
    return user


def link_google_id(user_id: uuid.UUID, google_id: str, avatar_url: str | None) -> None:
    """Populate google_id (and optionally avatar_url) on an existing email/password account."""
    sb = get_supabase()
    update: dict = {"google_id": google_id}
    if avatar_url:
        update["avatar_url"] = avatar_url
    sb.table("profiles").update(update).eq("id", str(user_id)).execute()


