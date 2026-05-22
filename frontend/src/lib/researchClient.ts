/**
 * Research Digest Agent — API client (Project 10)
 *
 * Exports:
 *  - TypeScript interfaces matching backend schemas
 *  - startResearchStream()  — SSE connection
 *  - runResearchQuery()     — non-streaming POST
 */
import api from "./api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaperCard {
  title: string;
  authors: string[];
  summary: string;
  published: string;
  arxiv_url: string;
  pdf_url: string;
  entry_id: string;
}

export interface ResearchDigest {
  topic: string;
  key_findings: string[];
  important_papers: PaperCard[];
  technical_insights: string;
  research_trends: string;
  limitations: string;
  future_scope: string;
  final_summary: string;
  confidence_score: number;
  papers_analyzed: number;
}

export interface StreamEvent {
  event: "status" | "tool_call" | "thinking" | "paper_found" | "digest_chunk" | "done" | "error";
  data: string;
  metadata?: Record<string, unknown>;
}

// ── SSE stream ─────────────────────────────────────────────────────────────

/**
 * Opens an SSE connection to the research stream endpoint.
 * Cookies are forwarded automatically by the Vite proxy (same-origin).
 * The caller is responsible for closing the EventSource when done.
 */
export function startResearchStream(
  query: string,
  maxPapers: number,
): EventSource {
  const params = new URLSearchParams({
    query,
    max_papers: String(maxPapers),
  });
  return new EventSource(`/api/research/stream?${params.toString()}`);
}

// ── Non-streaming POST ─────────────────────────────────────────────────────

export async function runResearchQuery(
  query: string,
  maxPapers: number,
): Promise<ResearchDigest> {
  const res = await api.post<ResearchDigest>("/api/research/query", {
    query,
    max_papers: maxPapers,
  });
  return res.data;
}
