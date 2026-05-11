"""Conversational memory utilities.

Fetches the last N turns from the DB and returns them as LangChain message
objects ready to be injected into a MessagesPlaceholder.
"""
import uuid
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.db.supabase_client import get_supabase


async def get_last_5_turns(db: Any, thread_id: uuid.UUID) -> list[BaseMessage]:
    """Return the last 5 user/assistant turn-pairs as LangChain messages.

    Queries chat_messages ordered by created_at DESC, takes up to 10 rows
    (5 user + 5 assistant), then reverses them so the list is in
    chronological order — oldest first — ready for MessagesPlaceholder.

    ``db`` is accepted for interface compatibility with a SQLAlchemy-session
    caller; the actual query goes through the Supabase HTTP client consistent
    with the rest of the service layer.
    """
    sb = get_supabase()
    res = (
        sb.table("chat_messages")
        .select("role, content")
        .eq("thread_id", str(thread_id))
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Reverse to restore chronological order (oldest → newest)
    rows: list[dict] = list(reversed(res.data or []))

    messages: list[BaseMessage] = []
    for row in rows:
        role = row.get("role", "")
        content = row.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    return messages
