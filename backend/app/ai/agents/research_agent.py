"""
Research Digest Agent — Project 10.

Agentic loop:
  1. Parse query → derive search terms
  2. Call arXiv search tool (up to RESEARCH_MAX_ITERATIONS times)
  3. Rank & de-duplicate papers
  4. Evaluate confidence based on paper count + keyword coverage
  5. Stream structured ResearchDigest via LLM

Each discrete pipeline step is wrapped as a LangChain RunnableLambda so that:
  - Steps can be individually traced in LangSmith
  - Each step is swappable without touching the agent loop
  - The loop calls .ainvoke() on runnables instead of raw service functions

Yields StreamEvent objects at every step so the frontend can show live activity.
"""
import asyncio
import json
from typing import AsyncIterator

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableLambda

from app.ai.llm import llm
from app.ai.mcp.client import arxiv_mcp_session
from app.ai.mcp.tool_loader import call_mcp_tool
from app.core.config import settings
from app.core.logging import logger
from app.schemas.research import PaperCard, ResearchDigest, StreamEvent


# ── Helpers ────────────────────────────────────────────────────────────────

def _event(kind: str, data: str, metadata: dict | None = None) -> StreamEvent:
    return StreamEvent(event=kind, data=data, metadata=metadata)


def _confidence(papers: list[PaperCard], query: str) -> float:
    """Heuristic confidence: 1.0 at 10+ papers, linearly down to 0.3 at 0 papers.
    Boosted slightly if query keywords appear in the top-3 paper titles.
    """
    base = min(len(papers) / 10.0, 1.0) * 0.7 + 0.3
    q_tokens = set(query.lower().split())
    title_hits = sum(
        1 for p in papers[:3]
        if any(tok in p.title.lower() for tok in q_tokens)
    )
    boost = min(title_hits * 0.05, 0.15)
    return min(round(base + boost, 2), 1.0)


def _broaden(query: str, iteration: int) -> str:
    """Return a progressively broader search query."""
    terms = query.split()[:max(2, len(query.split()) - iteration)]
    return " ".join(terms) + " survey review"


# ── RunnableLambda pipeline steps ──────────────────────────────────────────
# Each async function is a self-contained pipeline step wrapped in RunnableLambda.
# Benefits:
#   • Individually traced in LangSmith (each shows up as a named span)
#   • Swappable: replace the lambda without changing the agent loop
#   • Callable via .ainvoke(dict) — consistent with all LangChain runnables

async def _search_and_rank_step(inp: dict) -> list[PaperCard]:
    """Search arXiv for papers matching `query` and rank by relevance via MCP."""
    async with arxiv_mcp_session() as session:
        papers_data = await call_mcp_tool(
            session, "search_arxiv",
            {"query": inp["query"], "max_results": inp["max_papers"]},
        )
        papers = [PaperCard(**p) for p in papers_data]
        ranked_data = await call_mcp_tool(
            session, "rank_papers",
            {"papers": [p.model_dump() for p in papers], "query": inp["query"]},
        )
        return [PaperCard(**p) for p in ranked_data]


async def _fetch_latest_step(inp: dict) -> list[PaperCard]:
    """Fetch the most recently submitted arXiv papers on `query` via MCP."""
    async with arxiv_mcp_session() as session:
        papers_data = await call_mcp_tool(
            session, "fetch_latest",
            {"topic": inp["query"], "max_results": inp.get("max_results", 5)},
        )
        return [PaperCard(**p) for p in papers_data]


async def _rank_step(inp: dict) -> list[PaperCard]:
    """Re-rank a merged pool of PaperCard objects by relevance to `query` via MCP."""
    async with arxiv_mcp_session() as session:
        ranked_data = await call_mcp_tool(
            session, "rank_papers",
            {"papers": [p.model_dump() for p in inp["papers"]], "query": inp["query"]},
        )
        return [PaperCard(**p) for p in ranked_data]


async def _parse_digest_step(inp: dict) -> ResearchDigest:
    """Parse raw LLM JSON output into a structured ResearchDigest."""
    raw: str = inp["raw"].strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    data = json.loads(raw)
    return ResearchDigest(
        topic=data.get("topic", inp["query"]),
        key_findings=data.get("key_findings", []),
        important_papers=inp["papers"][:5],
        technical_insights=data.get("technical_insights", ""),
        research_trends=data.get("research_trends", ""),
        limitations=data.get("limitations", ""),
        future_scope=data.get("future_scope", ""),
        final_summary=data.get("final_summary", ""),
        confidence_score=inp["confidence"],
        papers_analyzed=len(inp["papers"]),
    )


# Module-level runnables — created once, reused across all requests
arxiv_search_runnable = RunnableLambda(_search_and_rank_step)
fetch_latest_runnable  = RunnableLambda(_fetch_latest_step)
rank_runnable          = RunnableLambda(_rank_step)
digest_parse_runnable  = RunnableLambda(_parse_digest_step)


# ── Main streaming entry point ─────────────────────────────────────────────

async def run_research_stream(
    query: str,
    max_papers: int = 10,
) -> AsyncIterator[StreamEvent]:
    """Async generator that yields StreamEvent objects for the full research pipeline."""

    papers: list[PaperCard] = []
    seen_ids: set[str] = set()
    iteration = 0
    current_query = query.strip()

    try:
        # ── Iterative search loop ──────────────────────────────────────────
        while iteration < settings.RESEARCH_MAX_ITERATIONS:
            iteration += 1
            yield _event("status", f"Searching arXiv… (attempt {iteration})")
            yield _event("tool_call", "mcp://arxiv-server/search_arxiv")

            try:
                new_papers = await arxiv_search_runnable.ainvoke(
                    {"query": current_query, "max_papers": max_papers}
                )
            except Exception as exc:
                logger.warning("arXiv search attempt %d failed: %s — retrying", iteration, exc)
                yield _event("status", "arXiv error — retrying with broader terms…")
                current_query = _broaden(query, iteration)
                await asyncio.sleep(1)
                continue

            # De-duplicate and emit paper_found events
            for paper in new_papers:
                if paper.entry_id not in seen_ids:
                    seen_ids.add(paper.entry_id)
                    papers.append(paper)
                    yield _event(
                        "paper_found",
                        paper.title,
                        metadata=paper.model_dump(),
                    )

            if not papers:
                yield _event("status", "No papers found — trying broader search…")
                current_query = _broaden(query, iteration)
                continue

            confidence = _confidence(papers, query)
            yield _event(
                "thinking",
                f"Found {len(papers)} papers. Confidence: {confidence:.0%}. "
                + ("Good — proceeding to analysis." if confidence >= settings.RESEARCH_CONFIDENCE_THRESHOLD
                   else "Low confidence — refining search terms…"),
            )

            if confidence >= settings.RESEARCH_CONFIDENCE_THRESHOLD:
                break

            # Refine search for next iteration
            current_query = _broaden(query, iteration)

        if not papers:
            yield _event("error", "No relevant papers found on arXiv for this query.")
            yield _event("done", "")
            return

        # ── Also fetch latest papers and merge ────────────────────────────
        yield _event("status", "Fetching latest submissions…")
        yield _event("tool_call", "mcp://arxiv-server/fetch_latest")
        try:
            latest = await fetch_latest_runnable.ainvoke(
                {"query": query, "max_results": 5}
            )
            for paper in latest:
                if paper.entry_id not in seen_ids:
                    seen_ids.add(paper.entry_id)
                    papers.append(paper)
                    yield _event("paper_found", paper.title, metadata=paper.model_dump())
        except Exception as exc:
            logger.warning("fetch_latest failed: %s", exc)

        # ── Rank by relevance ─────────────────────────────────────────────
        yield _event("status", "Ranking papers by relevance…")
        yield _event("tool_call", "mcp://arxiv-server/rank_papers")
        papers = await rank_runnable.ainvoke({"papers": papers, "query": query})
        papers = papers[:max_papers]

        final_confidence = _confidence(papers, query)

        # ── Generate digest ───────────────────────────────────────────────
        yield _event("status", "Analyzing findings and generating digest…")

        # Stream the raw LLM response as digest_chunk events
        system = (
            "You are a world-class research analyst. Given a set of arXiv papers, "
            "produce a structured research digest in strict JSON matching this schema:\n"
            "{\n"
            '  "topic": "<one-line topic>",\n'
            '  "key_findings": ["<finding1>", "<finding2>", "..."],\n'
            '  "technical_insights": "<detailed paragraph on methods and techniques>",\n'
            '  "research_trends": "<paragraph on where the field is heading>",\n'
            '  "limitations": "<paragraph on current gaps and challenges>",\n'
            '  "future_scope": "<paragraph on open problems and opportunities>",\n'
            '  "final_summary": "<2-3 sentence executive summary>"\n'
            "}\n"
            "Return ONLY the JSON object. No markdown fences, no extra text."
        )
        papers_text = "\n\n".join(
            f"[{i+1}] {p.title} ({p.published})\n"
            f"Authors: {', '.join(p.authors[:3])}\n"
            f"Abstract: {p.summary[:400]}"
            for i, p in enumerate(papers[:15])
        )
        human = (
            f"Research question: {query}\n\n"
            f"Papers analyzed ({len(papers)} total):\n\n{papers_text}"
        )

        raw_chunks: list[str] = []
        async for chunk in llm.astream(
            [SystemMessage(content=system), HumanMessage(content=human)]
        ):
            token = chunk.content
            if token:
                raw_chunks.append(token)
                yield _event("digest_chunk", token)

        # Parse full JSON via RunnableLambda
        raw = "".join(raw_chunks)
        digest = await digest_parse_runnable.ainvoke(
            {"raw": raw, "query": query, "papers": papers, "confidence": final_confidence}
        )

        yield _event("done", "Research complete.", metadata=digest.model_dump())

    except json.JSONDecodeError as exc:
        logger.error("Digest JSON parse error: %s", exc)
        yield _event("error", f"Failed to parse digest structure: {exc}")
        yield _event("done", "")
    except Exception as exc:
        logger.error("Research agent error: %s", exc, exc_info=True)
        yield _event("error", str(exc))
        yield _event("done", "")
