"""Schemas for the AI image generation endpoint."""
import uuid

from pydantic import BaseModel, Field


class ImageGenRequest(BaseModel):
    thread_id: uuid.UUID
    prompt: str = Field(..., min_length=1, max_length=1000)


class ImageGenResponse(BaseModel):
    image_url: str
    revised_prompt: str | None
    message_id: str
