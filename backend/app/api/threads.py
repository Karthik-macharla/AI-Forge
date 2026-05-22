"""Threads router — /api/threads/*"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.schemas.attachment import AttachmentResponse
from app.schemas.message import MessageResponse
from app.schemas.thread import ThreadCreate, ThreadResponse, ThreadUpdate
from app.services import message_service, thread_service
from app.db.supabase_client import get_supabase

router = APIRouter(prefix="/api/threads", tags=["Threads"])


@router.get("", response_model=list[ThreadResponse])
async def list_threads(current_user: CurrentUser = Depends(get_current_user)) -> list[ThreadResponse]:
    threads = thread_service.list_threads(current_user.id)
    return [ThreadResponse.model_validate(t) for t in threads]


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ThreadCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> ThreadResponse:
    title = (body.title or "New Chat")[:100]
    thread = thread_service.create_thread(current_user.id, title)
    return ThreadResponse.model_validate(thread)


@router.put("/{thread_id}", response_model=ThreadResponse)
async def rename_thread(
    thread_id: uuid.UUID,
    body: ThreadUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> ThreadResponse:
    thread = thread_service.get_thread(thread_id, current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Thread not found"},
        )
    title = body.title.strip()[:100] or "New Chat"
    thread_service.update_thread_title(thread_id, title)
    updated = thread_service.get_thread(thread_id, current_user.id)
    return ThreadResponse.model_validate(updated)


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    thread = thread_service.get_thread(thread_id, current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Thread not found"},
        )
    thread_service.delete_thread(thread_id)


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    thread_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MessageResponse]:
    thread = thread_service.get_thread(thread_id, current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Thread not found"},
        )
    messages = message_service.list_messages(thread_id)
    return [MessageResponse.model_validate(m) for m in messages]


@router.get("/{thread_id}/attachments", response_model=list[AttachmentResponse])
async def list_thread_attachments(
    thread_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> list[AttachmentResponse]:
    """Return all attachments that belong to a thread (for restoring message history)."""
    thread = thread_service.get_thread(thread_id, current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Thread not found"},
        )
    sb = get_supabase()
    res = (
        sb.table("attachments")
        .select("*")
        .eq("thread_id", str(thread_id))
        .order("created_at")
        .execute()
    )
    return [AttachmentResponse.model_validate(row) for row in res.data]


class RawMessageBody(BaseModel):
    role: str
    content: str


@router.post("/{thread_id}/messages/save", status_code=status.HTTP_200_OK)
async def save_raw_messages(
    thread_id: uuid.UUID,
    body: list[RawMessageBody],
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Persist pre-built user + assistant messages (NL2SQL, Sheets) to thread history."""
    thread = thread_service.get_thread(thread_id, current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Thread not found"},
        )
    for msg in body:
        if msg.role not in ("user", "assistant"):
            continue
        message_service.create_message(thread_id, msg.role, msg.content)
    return {"saved": len(body)}
