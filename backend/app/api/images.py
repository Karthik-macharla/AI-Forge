"""Images router — POST /api/images/generate"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAIError

from app.core.auth import CurrentUser, get_current_user
from app.schemas.image import ImageGenRequest, ImageGenResponse
from app.services import image_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["Images"])


@router.post(
    "/generate",
    response_model=ImageGenResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_image(
    body: ImageGenRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ImageGenResponse:
    """Generate an image from a text prompt and persist it as an attachment."""
    # Pydantic already enforces 1–1000 char constraint via Field on the schema,
    # but we raise an explicit 422 in the standard shape if somehow bypassed.
    if not body.prompt or len(body.prompt) > 1000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_error", "message": "Prompt must be 1–1000 characters"},
        )

    try:
        result = await image_service.generate_image(
            prompt=body.prompt,
            thread_id=body.thread_id,
            user_id=current_user.id,
            user_email=current_user.email,
        )
    except OpenAIError as exc:
        logger.error("Image generation OpenAI error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "image_gen_failed", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error("Image generation unexpected error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": str(exc)},
        ) from exc

    return ImageGenResponse(**result)
