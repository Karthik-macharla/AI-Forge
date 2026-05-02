from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/chat", tags=["Chat"])

client = OpenAI(
    api_key=settings.LITELLM_API_KEY,
    base_url=f"{settings.LITELLM_PROXY_URL}/v1",
)


class ChatRequest(BaseModel):
    message: str
    model: str | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str
    tokens_used: int


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    model = request.model or settings.LLM_MODEL

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": request.message},
        ],
        max_tokens=1024,
    )

    return ChatResponse(
        reply=response.choices[0].message.content,
        model=response.model,
        tokens_used=response.usage.total_tokens,
    )
