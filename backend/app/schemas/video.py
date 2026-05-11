"""Schemas for the AI video generation endpoint."""
import uuid

from pydantic import BaseModel, Field


class VideoGenRequest(BaseModel):
    thread_id: uuid.UUID
    prompt: str = Field(..., min_length=1, max_length=1000)


class VideoGenResponse(BaseModel):
    video_url: str
    message_id: str
