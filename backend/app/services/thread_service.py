"""Thread service — CRUD for chat_threads via Supabase HTTP API."""
import uuid
from dataclasses import dataclass
from datetime import datetime

from app.db.supabase_client import get_supabase


@dataclass
class Thread:
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: dict) -> "Thread":
        return cls(
            id=uuid.UUID(row["id"]),
            user_id=uuid.UUID(row["user_id"]),
            title=row["title"],
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")),
        )


def list_threads(user_id: uuid.UUID) -> list[Thread]:
    sb = get_supabase()
    res = sb.table("chat_threads").select("*").eq("user_id", str(user_id)).order("updated_at", desc=True).execute()
    return [Thread.from_row(r) for r in res.data]


def create_thread(user_id: uuid.UUID, title: str = "New Chat") -> Thread:
    sb = get_supabase()
    row = {"id": str(uuid.uuid4()), "user_id": str(user_id), "title": title}
    res = sb.table("chat_threads").insert(row).execute()
    return Thread.from_row(res.data[0])


def get_thread(thread_id: uuid.UUID, user_id: uuid.UUID) -> Thread | None:
    sb = get_supabase()
    res = (
        sb.table("chat_threads")
        .select("*")
        .eq("id", str(thread_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    if res.data:
        return Thread.from_row(res.data[0])
    return None


def update_thread_title(thread_id: uuid.UUID, title: str) -> None:
    sb = get_supabase()
    sb.table("chat_threads").update({"title": title}).eq("id", str(thread_id)).execute()


def touch_thread(thread_id: uuid.UUID) -> None:
    sb = get_supabase()
    sb.table("chat_threads").update({"updated_at": datetime.utcnow().isoformat()}).eq("id", str(thread_id)).execute()


def delete_thread(thread_id: uuid.UUID) -> None:
    sb = get_supabase()
    sb.table("chat_threads").delete().eq("id", str(thread_id)).execute()
