from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable

from app.ai.llm import llm

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "chat.txt"

_chain: Runnable | None = None


def build_chat_chain() -> Runnable:
    """Build (and cache) the LCEL chat chain.

    Expected input keys:
        - ``history``: list[BaseMessage]  — from MessagesPlaceholder
        - ``human_input``: str            — the current user message

    Returns a Runnable that streams str tokens.
    """
    global _chain
    if _chain is not None:
        return _chain

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8").strip()

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{human_input}"),
    ])

    _chain = prompt | llm | StrOutputParser()
    return _chain
