"""Videos router — POST /api/videos/generate"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.schemas.video import VideoGenRequest, VideoGenResponse
from app.services import video_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/videos", tags=["Videos"])


@router.post(
    "/generate",
    response_model=VideoGenResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_video(
    body: VideoGenRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoGenResponse:
    """Generate a video from a text prompt and persist it as an attachment."""
    if not body.prompt or len(body.prompt) > 1000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_error", "message": "Prompt must be 1–1000 characters"},
        )

    try:
        result = await video_service.generate_video(
            prompt=body.prompt,
            thread_id=body.thread_id,
            user_id=current_user.id,
            user_email=current_user.email,
        )
    except Exception as exc:
        logger.error("Video generation error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "video_gen_failed", "message": str(exc)},
        ) from exc

    return VideoGenResponse(**result)
