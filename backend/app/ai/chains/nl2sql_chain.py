"""
NL2SQL LCEL chains.

Chain 1 — generate_sql_chain : prompt | llm | StrOutputParser()
  Inputs : schema (str), dialect (str), question (str)
  Output : raw SQL string (no streaming needed)

Chain 2 — answer_chain : prompt | llm | StrOutputParser()
  Inputs : question (str), rows (str)
  Output : streamed natural-language tokens

Both chains import the llm singleton from app/ai/llm.py (AD-01).
"""
from pathlib import Path
from typing import AsyncIterator

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable

from app.ai.llm import llm

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# ── Cached chain instances ─────────────────────────────────────────────────

_sql_chain: Runnable | None = None
_answer_chain: Runnable | None = None


def build_sql_generation_chain() -> Runnable:
    """Return (and cache) the SQL-generation LCEL chain.

    Input keys : schema, dialect, question
    Output     : str — raw SQL SELECT statement
    """
    global _sql_chain
    if _sql_chain is not None:
        return _sql_chain

    template = (_PROMPTS_DIR / "nl2sql_generate.txt").read_text(encoding="utf-8").strip()
    prompt = ChatPromptTemplate.from_messages([("human", template)])
    _sql_chain = prompt | llm | StrOutputParser()
    return _sql_chain


def build_answer_chain() -> Runnable:
    """Return (and cache) the answer-generation LCEL chain.

    Input keys : question, rows
    Output     : streamed str tokens — natural-language explanation
    """
    global _answer_chain
    if _answer_chain is not None:
        return _answer_chain

    template = (_PROMPTS_DIR / "nl2sql_answer.txt").read_text(encoding="utf-8").strip()
    prompt = ChatPromptTemplate.from_messages([("human", template)])
    _answer_chain = prompt | llm | StrOutputParser()
    return _answer_chain


async def generate_sql(
    question: str,
    schema: str,
    dialect: str,
    user_email: str,
) -> str:
    """Invoke the SQL-generation chain (non-streaming).

    Returns the raw SQL string. Raises ValueError if the model returns an ERROR.
    """
    chain = build_sql_generation_chain()
    result: str = await chain.ainvoke(
        {"schema": schema, "dialect": dialect, "question": question},
        config={"metadata": {"user_email": user_email}},
    )
    sql = result.strip()
    if sql.upper().startswith("ERROR:"):
        raise ValueError(sql)
    return sql


async def stream_answer(
    question: str,
    rows_json: str,
    user_email: str,
) -> AsyncIterator[str]:
    """Stream natural-language answer tokens for the given question + result rows."""
    chain = build_answer_chain()
    async for token in chain.astream(
        {"question": question, "rows": rows_json},
        config={"metadata": {"user_email": user_email}},
    ):
        yield token
