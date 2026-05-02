"""Pydantic schemas for thread endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ThreadCreate(BaseModel):
    title: str | None = None


class ThreadUpdate(BaseModel):
    title: str


class ThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
