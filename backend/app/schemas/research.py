"""Pydantic schemas for Project 10 — Research Digest Agent."""
from typing import Optional
from pydantic import BaseModel, Field


class ResearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    max_papers: int = Field(default=10, ge=1, le=30)
    thread_id: Optional[str] = None


class PaperCard(BaseModel):
    title: str
    authors: list[str]
    summary: str
    published: str
    arxiv_url: str
    pdf_url: str
    entry_id: str


class ResearchDigest(BaseModel):
    topic: str
    key_findings: list[str]
    important_papers: list[PaperCard]
    technical_insights: str
    research_trends: str
    limitations: str
    future_scope: str
    final_summary: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    papers_analyzed: int


class StreamEvent(BaseModel):
    event: str  # status | tool_call | thinking | paper_found | digest_chunk | done | error
    data: str
    metadata: Optional[dict] = None
