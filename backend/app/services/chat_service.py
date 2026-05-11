"""Chat service — streams LLM response and persists messages to Supabase."""
import base64
import uuid
from pathlib import Path
from typing import AsyncIterator

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.ai.chains.chat_chain import build_chat_chain
from app.ai.memory.memory_utils import get_last_5_turns
from app.core.config import settings
from app.core.logging import logger
from app.db.supabase_client import get_supabase
from app.services import message_service, thread_service


async def _generate_title(first_message: str) -> str:
    """Use the LLM to generate a short thread title from the first user message."""
    try:
        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "Generate a concise chat thread title (max 6 words, no punctuation, no quotes) "
                "that captures the topic of the user's message. Reply with ONLY the title.",
            ),
            ("human", "{message}"),
        ])
        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            base_url=f"{settings.LITELLM_PROXY_URL}/v1",
            api_key=settings.LITELLM_API_KEY,
            streaming=False,
        )
        chain = prompt | llm | StrOutputParser()
        title = await chain.ainvoke({"message": first_message[:400]})
        title = title.strip().strip('"\'').strip()[:80]
        return title or first_message[:40]
    except Exception as exc:
        logger.warning("LLM title generation failed, using fallback: %s", exc)
        return (first_message[:40] + "…") if len(first_message) > 40 else first_message


def _build_attachment_messages(attachment_ids: list[str]) -> list[HumanMessage]:
    """Fetch each attachment from Supabase and build LangChain HumanMessages."""
    sb = get_supabase()
    extra: list[HumanMessage] = []
    for att_id in attachment_ids:
        res = (
            sb.table("attachments")
            .select("file_name, mime_type, file_path")
            .eq("id", att_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            logger.warning("Attachment %s not found — skipping", att_id)
            continue
        row = res.data[0]
        mime: str = row["mime_type"]
        file_path: str = row["file_path"]
        file_name: str = row["file_name"]

        try:
            if mime.startswith("image/"):
                b64 = base64.b64encode(Path(file_path).read_bytes()).decode()
                extra.append(
                    HumanMessage(
                        content=[
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{b64}"},
                            }
                        ]
                    )
                )
            else:
                # PDF, text, code, excel — inject first 4000 chars as text
                text = Path(file_path).read_text(encoding="utf-8", errors="replace")[:4000]
                extra.append(
                    HumanMessage(content=f"[Attachment: {file_name}]\n{text}")
                )
        except Exception as exc:
            logger.warning("Could not read attachment %s: %s", att_id, exc)

    return extra


async def stream_chat(
    message: str,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    user_email: str,
    attachment_ids: list[str] = [],
) -> AsyncIterator[str]:
    # Phase 1: pre-stream writes
    thread = thread_service.get_thread(thread_id, user_id)
    if not thread:
        yield "[ERROR: Thread not found or access denied]"
        return

    if thread.title == "New Chat":
        new_title = await _generate_title(message)
        thread_service.update_thread_title(thread_id, new_title)

    # Fetch rolling 5-turn history BEFORE saving the new user message so that
    # the current turn is not included in the history window.
    history = await get_last_5_turns(None, thread_id)

    # Inject attachment context into history (AFTER rolling history, BEFORE human_input)
    if attachment_ids:
        history = history + _build_attachment_messages(attachment_ids)

    message_service.create_message(thread_id, "user", message)

    # Phase 2: LLM streaming
    chain = build_chat_chain()
    full_response: list[str] = []
    try:
        async for token in chain.astream(
            {"history": history, "human_input": message},
            config={"metadata": {"user_email": user_email}},
        ):
            full_response.append(token)
            yield token
    except Exception as exc:
        logger.error("LLM streaming error: %s", exc)
        fallback = "\n\n[Sorry, an error occurred. Please try again.]"
        full_response.append(fallback)
        yield fallback

    # Phase 3: post-stream writes
    assembled = "".join(full_response)
    if assembled:
        message_service.create_message(thread_id, "assistant", assembled)
        thread_service.touch_thread(thread_id)
