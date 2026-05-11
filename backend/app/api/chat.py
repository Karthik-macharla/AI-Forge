from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.auth import CurrentUser, get_current_user
from app.schemas.chat import ChatRequest
from app.services import chat_service

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    return StreamingResponse(
        chat_service.stream_chat(
            message=request.message,
            thread_id=request.thread_id,
            user_id=current_user.id,
            user_email=current_user.email,
            attachment_ids=request.attachment_ids,
        ),
        media_type="text/event-stream",
    )
