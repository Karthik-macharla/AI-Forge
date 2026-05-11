"""AI video generation service.

Calls the LiteLLM proxy's video generation endpoint, downloads the result,
persists it to disk, and stores Supabase records — identical pattern to image_service.
"""
import asyncio
import base64
import uuid
from pathlib import Path

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.db.supabase_client import get_supabase


async def generate_video(
    prompt: str,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    user_email: str,
) -> dict:
    """Generate a video via the LiteLLM proxy, persist it, and store Supabase records.

    Returns a dict with keys: video_url, message_id.
    """
    logger.info("Video generation requested: model=%s prompt=%.80s", settings.VIDEO_GEN_MODEL, prompt)

    # ── 1. Call the LiteLLM proxy video generation endpoint ───────────────
    # The proxy exposes /v1/video/generations for video models (e.g. Veo 2).
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{settings.LITELLM_PROXY_URL}/v1/video/generations",
            headers={
                "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.VIDEO_GEN_MODEL,
                "prompt": prompt,
                "user": user_email,
            },
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("Video gen proxy error %s: %s", exc.response.status_code, exc.response.text)
            raise

        result = resp.json()

    # ── 2. Decode video bytes — b64_json or temporary URL ─────────────────
    video_data = result.get("data", [{}])[0]
    b64: str | None = video_data.get("b64_json") or video_data.get("b64")
    url: str | None = video_data.get("url")

    if b64:
        video_bytes = base64.b64decode(b64)
    elif url:
        async with httpx.AsyncClient(timeout=120) as client:
            dl = await client.get(url)
            dl.raise_for_status()
            video_bytes = dl.content
    else:
        raise ValueError(f"Video generation response contained neither b64_json nor url. Keys: {list(video_data.keys())}")

    # ── 3. Persist to disk ────────────────────────────────────────────────
    user_dir = Path(settings.UPLOAD_DIR) / str(user_id) / "videos"
    user_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"gen_{uuid.uuid4()}.mp4"
    dest = user_dir / file_name
    await asyncio.to_thread(dest.write_bytes, video_bytes)
    logger.info("Saved generated video to %s (%d bytes)", dest, len(video_bytes))

    # ── 4. Supabase: store records ────────────────────────────────────────
    sb = get_supabase()
    attachment_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    # User prompt row
    sb.table("chat_messages").insert({
        "id": str(uuid.uuid4()),
        "thread_id": str(thread_id),
        "role": "user",
        "content": f"/video {prompt}",
    }).execute()

    # Assistant message with video markdown
    sb.table("chat_messages").insert({
        "id": message_id,
        "thread_id": str(thread_id),
        "role": "assistant",
        "content": f"![video:Generated video](/api/attachments/{attachment_id}/file)",
    }).execute()

    # Attachments row
    sb.table("attachments").insert({
        "id": attachment_id,
        "message_id": message_id,
        "thread_id": str(thread_id),
        "user_id": str(user_id),
        "file_name": file_name,
        "mime_type": "video/mp4",
        "attachment_type": "video",
        "file_path": str(dest),
        "file_size_bytes": len(video_bytes),
    }).execute()

    return {
        "video_url": f"/api/attachments/{attachment_id}/file",
        "message_id": message_id,
    }
