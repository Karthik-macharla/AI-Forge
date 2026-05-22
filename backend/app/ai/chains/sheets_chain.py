"""
Sheets agent chain — Project 9.

Wraps LangChain's Pandas DataFrame agent. The agent is created fresh per request
because the DataFrame differs per call. The llm singleton is imported from
app/ai/llm.py (AD-01).

Uses create_pandas_dataframe_agent from langchain_experimental.
"""
from typing import AsyncIterator

import pandas as pd
from langchain_experimental.agents import create_pandas_dataframe_agent

from app.ai.llm import llm
from app.core.config import settings
from app.core.logging import logger


async def stream_dataframe_answer(
    df: pd.DataFrame,
    question: str,
    user_email: str,
) -> AsyncIterator[str]:
    """Create a Pandas DataFrame agent and stream its answer token by token.

    The agent is allowed to run Python (pandas) internally. The answer is the
    agent's final natural-language output, streamed as tokens.
    """
    # Cap rows to avoid token overflow
    if len(df) > settings.SHEETS_MAX_ROWS:
        logger.warning(
            "DataFrame has %d rows — truncating to %d for agent",
            len(df), settings.SHEETS_MAX_ROWS,
        )
        df = df.head(settings.SHEETS_MAX_ROWS)

    # Inspect actual column names so we can tell the agent about them
    col_list = ", ".join(f"'{c}'" for c in df.columns.tolist())

    prefix = (
        "You are a data analyst working with a pandas DataFrame called `df`.\n"
        f"The DataFrame has these columns: {col_list}.\n"
        "The DataFrame may contain data from multiple worksheet tabs combined into one.\n"
        "If a '_Sheet' column is present, it shows which worksheet tab each row belongs to.\n"
        "\n"
        "AMBIGUITY RESOLUTION — when the user mentions a short label like 'FN', 'UI', etc.:\n"
        "  1. First check if a 'Type' (or similar) column contains that value.\n"
        "     If yes, filter by that column: df[df['Type'].str.contains('FN', case=False, na=False)]\n"
        "  2. Also check if '_Sheet' contains that value.\n"
        "  3. If both match, prefer the Type column interpretation UNLESS the user explicitly\n"
        "     says 'sheet tab' or 'worksheet'.\n"
        "  4. Always state which interpretation you used in your answer.\n"
        "\n"
        "IMPORTANT rules for filtering by person names or any text fields:\n"
        "  - NEVER use exact equality (==) for name lookups.\n"
        "  - ALWAYS use case-insensitive partial matching:\n"
        "    df[df['column'].str.contains('value', case=False, na=False)]\n"
        "  - If the user provides a full name (e.g. 'Karthik Macherla'),\n"
        "    use only the first/last distinctive part for the contains filter\n"
        "    unless the full name clearly appears verbatim in the data.\n"
        "  - For status, category, or other categorical columns, still prefer\n"
        "    case-insensitive contains over exact match.\n"
    )

    agent = create_pandas_dataframe_agent(
        llm=llm,
        df=df,
        agent_type="tool-calling",   # string literal — works across all langchain versions
        verbose=False,
        allow_dangerous_code=True,   # Required in langchain-experimental >= 0.0.43
        handle_parsing_errors=True,
        prefix=prefix,
    )

    # Run agent synchronously (ainvoke is reliable; astream_events can miss final tokens
    # in tool-calling agents depending on LangChain version).
    result = await agent.ainvoke(
        {"input": question},
        config={"metadata": {"user_email": user_email}},
    )
    output: str = result.get("output") or "I couldn't determine an answer from the data."

    # Yield word-by-word for a streaming feel
    words = output.split(" ")
    for i, word in enumerate(words):
        chunk = word if i == len(words) - 1 else word + " "
        yield chunk
