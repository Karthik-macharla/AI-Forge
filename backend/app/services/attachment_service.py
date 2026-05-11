"""Attachment service — file validation, disk persistence, and Supabase records."""
import asyncio
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import logger
from app.db.supabase_client import get_supabase

# Maps MIME type prefix/exact values to the attachment_type taxonomy
_MIME_TO_TYPE: dict[str, str] = {
    "image/": "image",
    "video/": "video",
    "application/pdf": "pdf",
    "text/x-python": "code",
    "text/javascript": "code",
    "text/plain": "code",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
}


def _classify(mime_type: str) -> str:
    for prefix, kind in _MIME_TO_TYPE.items():
        if mime_type.startswith(prefix):
            return kind
    return "code"  # safe fallback for other text types


def _allowed_mimes() -> set[str]:
    return {m.strip() for m in settings.ACCEPTED_MIME_TYPES.split(",")}


async def save_attachment(
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    """Validate, save to disk, and record in Supabase. Returns the attachment row dict."""

    # ── MIME validation ────────────────────────────────────────────────────
    mime = file.content_type or ""
    if mime not in _allowed_mimes():
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": "unsupported_mime", "message": f"File type '{mime}' is not allowed"},
        )

    # ── Read bytes (enforces size limit) ───────────────────────────────────
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "file_too_large",
                "message": f"File exceeds the {settings.MAX_UPLOAD_MB} MB limit",
            },
        )

    # ── Save to disk ───────────────────────────────────────────────────────
    att_type = _classify(mime)
    # Organise by type: storage/{user_id}/images|videos|documents/
    type_dir = {
        "image": "images",
        "video": "videos",
        "pdf":   "documents",
        "excel": "documents",
        "code":  "documents",
    }.get(att_type, "documents")
    user_dir = Path(settings.UPLOAD_DIR) / str(user_id) / type_dir
    user_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "upload").name  # strip any path traversal
    dest = user_dir / f"{uuid.uuid4()}_{safe_name}"
    dest.write_bytes(data)
    logger.info("Saved attachment to %s (%d bytes)", dest, len(data))

    # ── Supabase: create placeholder chat_messages row ────────────────────
    sb = get_supabase()
    msg_row = {
        "id": str(uuid.uuid4()),
        "thread_id": str(thread_id),
        "role": "attachment",
        "content": "",
    }
    msg_res = sb.table("chat_messages").insert(msg_row).execute()
    message_id = msg_res.data[0]["id"]

    # ── Supabase: create attachments row ──────────────────────────────────
    attachment_id = str(uuid.uuid4())
    att_row = {
        "id": attachment_id,
        "message_id": message_id,
        "thread_id": str(thread_id),
        "user_id": str(user_id),
        "file_name": file.filename or safe_name,
        "mime_type": mime,
        "attachment_type": _classify(mime),
        "file_path": str(dest),
        "file_size_bytes": len(data),
    }
    att_res = sb.table("attachments").insert(att_row).execute()
    row = att_res.data[0]

    # ── Background RAG indexing (non-blocking) ────────────────────────────
    async def _index():
        try:
            from app.ai.rag.indexer import index_attachment
            n = await index_attachment(
                attachment_id=attachment_id,
                file_path=str(dest),
                mime_type=mime,
                file_name=file.filename or safe_name,
                user_id=str(user_id),
                thread_id=str(thread_id),
            )
            logger.info("RAG indexing complete: %d chunks for %s", n, attachment_id)
        except Exception as exc:  # never crash the upload response
            logger.error("RAG indexing failed for %s: %s", attachment_id, exc, exc_info=True)

    if background_tasks is not None:
        background_tasks.add_task(_index)
    else:
        asyncio.create_task(_index())
    return row


def get_attachment_path(attachment_id: str) -> str | None:
    """Return the disk path for an attachment, or None if not found."""
    sb = get_supabase()
    res = (
        sb.table("attachments")
        .select("file_path")
        .eq("id", attachment_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["file_path"]
    return None
