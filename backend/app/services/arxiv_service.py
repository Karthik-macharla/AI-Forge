"""
arXiv service — Project 10.

Wraps the `arxiv` Python package. All sync arxiv calls run inside
asyncio.to_thread() so the async event loop is never blocked.
"""
import asyncio
from datetime import datetime

import arxiv

from app.core.logging import logger
from app.schemas.research import PaperCard


def _paper_to_card(result: arxiv.Result) -> PaperCard:
    """Convert an arxiv.Result to a PaperCard schema."""
    published = (
        result.published.strftime("%Y-%m-%d")
        if isinstance(result.published, datetime)
        else str(result.published)
    )
    return PaperCard(
        title=result.title.strip(),
        authors=[str(a) for a in result.authors[:6]],  # cap at 6 authors
        summary=result.summary.strip()[:1200],  # truncate very long abstracts
        published=published,
        arxiv_url=result.entry_id,
        pdf_url=result.pdf_url or "",
        entry_id=result.entry_id,
    )


def _sync_search(query: str, max_results: int) -> list[PaperCard]:
    client = arxiv.Client(page_size=max_results, delay_seconds=1, num_retries=2)
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results = list(client.results(search))
    return [_paper_to_card(r) for r in results]


def _sync_fetch_latest(topic: str, max_results: int) -> list[PaperCard]:
    client = arxiv.Client(page_size=max_results, delay_seconds=1, num_retries=2)
    search = arxiv.Search(
        query=topic,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
    )
    results = list(client.results(search))
    return [_paper_to_card(r) for r in results]


async def search_papers(query: str, max_results: int = 10) -> list[PaperCard]:
    """Search arXiv by relevance. Returns up to max_results PaperCard objects."""
    logger.info("arXiv search: query=%r max_results=%d", query, max_results)
    try:
        papers = await asyncio.to_thread(_sync_search, query, max_results)
        logger.info("arXiv returned %d papers for %r", len(papers), query)
        return papers
    except Exception as exc:
        logger.error("arXiv search error: %s", exc)
        raise


async def fetch_latest_papers(topic: str, max_results: int = 5) -> list[PaperCard]:
    """Fetch most recently submitted papers on a topic."""
    logger.info("arXiv fetch latest: topic=%r max_results=%d", topic, max_results)
    try:
        return await asyncio.to_thread(_sync_fetch_latest, topic, max_results)
    except Exception as exc:
        logger.error("arXiv fetch latest error: %s", exc)
        raise


async def rank_by_relevance(papers: list[PaperCard], query: str) -> list[PaperCard]:
    """Score papers by keyword overlap on title + summary. Returns re-sorted list."""
    query_tokens = set(query.lower().split())

    def score(p: PaperCard) -> float:
        text = (p.title + " " + p.summary).lower().split()
        matches = sum(1 for token in text if token in query_tokens)
        return matches / (len(text) + 1)

    return sorted(papers, key=score, reverse=True)
