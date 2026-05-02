from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from app.core.config import settings

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "chat.txt"

_chain: Runnable | None = None


def get_chat_chain() -> Runnable:
    global _chain
    if _chain is not None:
        return _chain

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8").strip()

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        HumanMessagePromptTemplate.from_template("{human_input}"),
    ])

    llm = ChatOpenAI(
        model="gemini/gemini-2.5-flash",
        base_url=f"{settings.LITELLM_PROXY_URL}/v1",
        api_key=settings.LITELLM_API_KEY,
        streaming=True,
    )

    _chain = prompt | llm | StrOutputParser()
    return _chain
