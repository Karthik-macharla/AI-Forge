"""RAG retriever — similarity search + answer generation.

Query the ChromaDB vectorstore filtered by thread_id, so each conversation
only searches documents uploaded in that thread. Retrieve the top-k relevant
chunks and stream an LLM answer grounded in those chunks.
"""
import asyncio
from typing import AsyncIterator

from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.ai.llm import embeddings, llm
from app.ai.rag.indexer import COLLECTION_NAME
from app.core.config import settings
from app.core.logging import logger

_TOP_K = 5

_RAG_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful assistant. Answer the user's question using ONLY the "
        "provided document excerpts. If the answer is not in the excerpts, say so. "
        "Always cite the source document name(s) at the end of your answer.\n\n"
        "Document excerpts:\n{context}",
    ),
    ("human", "{question}"),
])


def _get_vectorstore() -> Chroma:
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PERSIST_DIR,
    )


async def retrieve_and_stream(
    question: str,
    thread_id: str,
) -> AsyncIterator[str]:
    """Retrieve relevant chunks for *question* and stream an LLM answer.

    Filters strictly by thread_id — each conversation only sees documents
    that were uploaded within that thread.
    """
    # ── 1. Similarity search (sync Chroma → thread pool) ──────────────────
    def _search() -> list:
        vs = _get_vectorstore()
        # Scope search to this thread only.
        # Use explicit $eq operator — required by ChromaDB >= 0.4 and langchain_chroma.
        where: dict = {"thread_id": {"$eq": thread_id}}
        try:
            return vs.similarity_search(question, k=_TOP_K, filter=where)
        except Exception as exc:
            logger.warning("RAG search with filter failed (%s), retrying without filter", exc)
            return []

    docs = await asyncio.to_thread(_search)

    if not docs:
        yield (
            "No documents have been uploaded to this conversation yet. "
            "Use the **+** button → **Upload to docs** to add a file, then search again."
        )
        return

    # ── 2. Build context string from retrieved chunks ──────────────────────
    context_parts = []
    for doc in docs:
        fname = doc.metadata.get("file_name", "unknown")
        context_parts.append(f"[{fname}]\n{doc.page_content}")
    context = "\n\n---\n\n".join(context_parts)

    logger.info("RAG: retrieved %d chunks for question: %.80s", len(docs), question)

    # ── 3. Stream LLM answer grounded in context ───────────────────────────
    chain = _RAG_PROMPT | llm | StrOutputParser()
    async for token in chain.astream({"context": context, "question": question}):
        yield token
