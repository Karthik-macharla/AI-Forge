"""Attachments router — /api/attachments/*"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.auth import CurrentUser, get_current_user
from app.schemas.attachment import AttachmentResponse
from app.services import attachment_service

router = APIRouter(prefix="/api/attachments", tags=["Attachments"])


@router.post("/", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    thread_id: str = Form(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> AttachmentResponse:
    row = await attachment_service.save_attachment(
        thread_id=uuid.UUID(thread_id),
        user_id=current_user.id,
        file=file,
        background_tasks=background_tasks,
    )
    return AttachmentResponse(**row)


@router.get("/{attachment_id}/file")
async def serve_attachment(
    attachment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    path = attachment_service.get_attachment_path(attachment_id)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Attachment not found"},
        )
    return FileResponse(path)
