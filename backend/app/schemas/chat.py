import uuid

from pydantic import BaseModel


class ChatRequest(BaseModel):
    thread_id: uuid.UUID
    message: str


class ChatResponse(BaseModel):
    reply: str
