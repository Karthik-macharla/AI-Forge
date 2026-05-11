import uuid

from pydantic import BaseModel


class ChatRequest(BaseModel):
    thread_id: uuid.UUID
    message: str
    attachment_ids: list[str] = []


class ChatResponse(BaseModel):
    reply: str
