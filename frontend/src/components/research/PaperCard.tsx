import { useState } from "react";
import type { PaperCard as PaperCardType } from "../../lib/researchClient";

interface PaperCardProps {
  paper: PaperCardType;
}

export default function PaperCard({ paper }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE = 220;
  const isTruncatable = paper.summary.length > TRUNCATE;
  const displaySummary =
    expanded || !isTruncatable ? paper.summary : paper.summary.slice(0, TRUNCATE) + "…";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
      {/* Title */}
      <h3 className="font-semibold text-sm text-slate-800 leading-snug">{paper.title}</h3>

      {/* Authors + date */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs text-slate-500">
          {paper.authors.slice(0, 3).join(", ")}
          {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-400">{paper.published}</span>
      </div>

      {/* Abstract */}
      <p className="text-xs text-slate-600 leading-relaxed">{displaySummary}</p>
      {isTruncatable && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 text-left"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {/* Links */}
      <div className="flex gap-3 mt-1">
        <a
          href={paper.arxiv_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          arXiv
        </a>
        {paper.pdf_url && (
          <a
            href={paper.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-red-600 hover:underline flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF
          </a>
        )}
      </div>
    </div>
  );
}
