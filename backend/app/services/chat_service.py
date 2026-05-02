"""Chat service — streams LLM response and persists messages to Supabase."""
import uuid
from typing import AsyncIterator

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.ai.chains.chat_chain import get_chat_chain
from app.core.config import settings
from app.core.logging import logger
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


async def stream_chat(
    message: str,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    user_email: str,
) -> AsyncIterator[str]:
    # Phase 1: pre-stream writes
    thread = thread_service.get_thread(thread_id, user_id)
    if not thread:
        yield "[ERROR: Thread not found or access denied]"
        return

    if thread.title == "New Chat":
        new_title = await _generate_title(message)
        thread_service.update_thread_title(thread_id, new_title)

    message_service.create_message(thread_id, "user", message)

    # Phase 2: LLM streaming
    chain = get_chat_chain()
    full_response: list[str] = []
    try:
        async for token in chain.astream(
            {"human_input": message},
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
