"""
MCP Server — arXiv tools (Project 12).

Runs as a subprocess via stdio transport.
Exposes three tools that wrap app/services/arxiv_service.py so that
research_agent.py can call them over the MCP protocol instead of
importing the service directly.

Usage (subprocess, stdio transport):
    python mcp_servers/arxiv_server.py
"""
import sys
import os

# Allow imports from the backend/ root regardless of working directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mcp.server.fastmcp import FastMCP

from app.services import arxiv_service
from app.schemas.research import PaperCard

mcp = FastMCP("arxiv-server")


@mcp.tool()
async def search_arxiv(query: str, max_results: int = 10) -> list[dict]:
    """Search arXiv for papers sorted by relevance. Returns list of paper objects."""
    papers = await arxiv_service.search_papers(query, max_results)
    return [p.model_dump() for p in papers]


@mcp.tool()
async def fetch_latest(topic: str, max_results: int = 5) -> list[dict]:
    """Fetch most recently submitted arXiv papers on a topic."""
    papers = await arxiv_service.fetch_latest_papers(topic, max_results)
    return [p.model_dump() for p in papers]


@mcp.tool()
async def rank_papers(papers: list[dict], query: str) -> list[dict]:
    """Re-rank a list of paper objects by relevance to the query."""
    paper_cards = [PaperCard(**p) for p in papers]
    ranked = await arxiv_service.rank_by_relevance(paper_cards, query)
    return [p.model_dump() for p in ranked]


if __name__ == "__main__":
    mcp.run(transport="stdio")
