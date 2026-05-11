"""RAG router — /api/rag/*"""
import asyncio
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, get_current_user
from app.ai.rag.retriever import retrieve_and_stream

router = APIRouter(prefix="/api/rag", tags=["RAG"])


class RagQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    thread_id: uuid.UUID  # required — KB is scoped per conversation


@router.post("/query")
async def rag_query(
    body: RagQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """Stream an LLM answer grounded in documents uploaded to this thread."""
    async def _stream():
        async for token in retrieve_and_stream(
            question=body.question,
            thread_id=str(body.thread_id),
        ):
            yield token

    return StreamingResponse(_stream(), media_type="text/plain")


@router.get("/debug")
async def rag_debug(
    thread_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Inspect ChromaDB — shows chunks indexed for a specific thread.

    Usage: GET /api/rag/debug?thread_id=<uuid>
    """
    from app.ai.rag.indexer import _get_vectorstore

    def _check():
        vs = _get_vectorstore()
        col = vs._collection
        thread_results = col.get(where={"thread_id": {"$eq": str(thread_id)}})
        all_results = col.get()
        file_names = list({
            m.get("file_name", "unknown")
            for m in (thread_results.get("metadatas") or [])
        })
        return {
            "thread_id": str(thread_id),
            "user_id": str(current_user.id),
            "thread_chunks": len(thread_results.get("ids") or []),
            "thread_files": file_names,
            "total_chunks_in_db": len(all_results.get("ids") or []),
            "sample_ids": (thread_results.get("ids") or [])[:5],
        }

    return await asyncio.to_thread(_check)
