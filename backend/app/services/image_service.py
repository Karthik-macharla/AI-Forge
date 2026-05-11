"""AI image generation service.

Handles both URL-based and base64-encoded responses from the LiteLLM proxy so
it works with Imagen, DALL-E, and any other model the proxy supports.
Persists the image as an Attachment served via /api/attachments/{id}/file.
"""
import asyncio
import base64
import uuid
from pathlib import Path

import httpx

from app.ai.llm import openai_client
from app.core.config import settings
from app.core.logging import logger
from app.db.supabase_client import get_supabase


async def generate_image(
    prompt: str,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    user_email: str,
) -> dict:
    """Generate an image via the LiteLLM proxy, persist it, and store Supabase records.

    Returns a dict with keys: image_url, revised_prompt, message_id.
    """
    logger.info("Image generation requested: model=%s prompt=%.80s", settings.IMAGE_GEN_MODEL, prompt)

    # ── 1. Call the LiteLLM proxy (sync SDK → run in thread pool) ─────────
    def _call_api() -> object:
        return openai_client.images.generate(
            model=settings.IMAGE_GEN_MODEL,
            prompt=prompt,
            n=1,
            response_format="b64_json",   # request base64 so we never chase temp URLs
            user=user_email,
            extra_body={
                "metadata": {
                    "application": settings.APP_NAME,
                    "environment": settings.ENVIRONMENT,
                }
            },
        )

    response = await asyncio.to_thread(_call_api)

    image_data = response.data[0]
    revised_prompt: str | None = getattr(image_data, "revised_prompt", None)

    # ── 2. Decode image bytes — prefer b64_json, fall back to URL ────────
    b64: str | None = getattr(image_data, "b64_json", None)
    if b64:
        image_bytes = base64.b64decode(b64)
    else:
        temporary_url: str = image_data.url or ""
        if not temporary_url:
            raise ValueError("Image generation response contained neither b64_json nor url")
        async with httpx.AsyncClient(timeout=60) as client:
            dl = await client.get(temporary_url)
            dl.raise_for_status()
            image_bytes = dl.content

    # ── 3. Persist to disk ────────────────────────────────────────────────
    user_dir = Path(settings.UPLOAD_DIR) / str(user_id) / "images"
    user_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"gen_{uuid.uuid4()}.png"
    dest = user_dir / file_name
    dest.write_bytes(image_bytes)
    logger.info("Saved generated image to %s (%d bytes)", dest, len(image_bytes))

    # ── 4. Supabase: store the attachment record ──────────────────────────
    sb = get_supabase()
    attachment_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    # Save the user's prompt as a chat_messages row so it persists in history
    user_msg_row = {
        "id": str(uuid.uuid4()),
        "thread_id": str(thread_id),
        "role": "user",
        "content": f"/image {prompt}",
    }
    sb.table("chat_messages").insert(user_msg_row).execute()

    # chat_messages row (role=assistant so it shows up in thread history)
    msg_row = {
        "id": message_id,
        "thread_id": str(thread_id),
        "role": "assistant",
        "content": f"![Generated image](/api/attachments/{attachment_id}/file)",
    }
    sb.table("chat_messages").insert(msg_row).execute()

    # attachments row
    att_row = {
        "id": attachment_id,
        "message_id": message_id,
        "thread_id": str(thread_id),
        "user_id": str(user_id),
        "file_name": file_name,
        "mime_type": "image/png",
        "attachment_type": "image",
        "file_path": str(dest),
        "file_size_bytes": len(image_bytes),
    }
    sb.table("attachments").insert(att_row).execute()

    return {
        "image_url": f"/api/attachments/{attachment_id}/file",
        "revised_prompt": revised_prompt,
        "message_id": message_id,
    }
