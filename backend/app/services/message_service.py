"""Message service — CRUD for chat_messages via Supabase HTTP API."""
import uuid
from dataclasses import dataclass
from datetime import datetime

from app.db.supabase_client import get_supabase


@dataclass
class Message:
    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    @classmethod
    def from_row(cls, row: dict) -> "Message":
        return cls(
            id=uuid.UUID(row["id"]),
            thread_id=uuid.UUID(row["thread_id"]),
            role=row["role"],
            content=row["content"],
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        )


def list_messages(thread_id: uuid.UUID) -> list[Message]:
    sb = get_supabase()
    res = sb.table("chat_messages").select("*").eq("thread_id", str(thread_id)).order("created_at").execute()
    return [Message.from_row(r) for r in res.data]


def create_message(thread_id: uuid.UUID, role: str, content: str) -> Message:
    sb = get_supabase()
    row = {"id": str(uuid.uuid4()), "thread_id": str(thread_id), "role": role, "content": content}
    res = sb.table("chat_messages").insert(row).execute()
    return Message.from_row(res.data[0])

