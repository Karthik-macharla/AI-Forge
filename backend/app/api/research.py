"""
Research Digest Agent API — Project 10.

Routes:
  POST /api/research/query   — non-streaming, returns ResearchDigest
  GET  /api/research/stream  — SSE stream of StreamEvent objects
  GET  /api/research/history — last 10 in-memory queries
"""
from collections import deque
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sse_starlette.sse import EventSourceResponse

from app.ai.agents.research_agent import run_research_stream
from app.core.auth import CurrentUser, get_current_user
from app.core.logging import logger
from app.schemas.research import ResearchDigest, ResearchQuery, StreamEvent

router = APIRouter(prefix="/api/research", tags=["research"])

# Simple in-memory history (no DB needed for Project 10)
_history: deque[dict] = deque(maxlen=10)


# ── POST /api/research/query ───────────────────────────────────────────────

@router.post("/query", response_model=ResearchDigest)
async def research_query(
    body: ResearchQuery,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ResearchDigest:
    """Run the full research pipeline synchronously and return a ResearchDigest."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail={"error": "empty_query", "message": "Query cannot be empty."})

    digest: ResearchDigest | None = None
    async for event in run_research_stream(query, body.max_papers):
        if event.event == "done" and event.metadata:
            try:
                digest = ResearchDigest(**event.metadata)
            except Exception:
                pass
        elif event.event == "error":
            raise HTTPException(
                status_code=502,
                detail={"error": "research_error", "message": event.data},
            )

    if digest is None:
        raise HTTPException(
            status_code=502,
            detail={"error": "no_digest", "message": "Agent did not produce a digest."},
        )

    _history.appendleft(
        {"query": query, "user": current_user.email, "at": datetime.now(timezone.utc).isoformat()}
    )
    return digest


# ── GET /api/research/stream ───────────────────────────────────────────────

@router.get("/stream")
async def research_stream(
    query: str = Query(..., min_length=1, max_length=500),
    max_papers: int = Query(default=10, ge=1, le=30),
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
) -> EventSourceResponse:
    """Stream research events as SSE. Auth via cookie (Vite proxy forwards cookies)."""
    logger.info("Research stream start: user=%s query=%r", current_user.email, query)

    async def _generator():
        try:
            async for ev in run_research_stream(query.strip(), max_papers):
                payload = ev.model_dump_json()
                yield {"event": ev.event, "data": payload}
                if ev.event == "done":
                    break
        except Exception as exc:
            logger.error("Research stream generator error: %s", exc)
            error_ev = StreamEvent(event="error", data=str(exc))
            yield {"event": "error", "data": error_ev.model_dump_json()}

    _history.appendleft(
        {"query": query, "user": current_user.email, "at": datetime.now(timezone.utc).isoformat()}
    )
    return EventSourceResponse(_generator())


# ── GET /api/research/history ──────────────────────────────────────────────

@router.get("/history")
async def research_history(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[dict]:
    """Return the last 10 research queries (in-memory, not persisted across restarts)."""
    return list(_history)
