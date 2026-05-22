import ReactMarkdown from "react-markdown";
import type { ResearchDigest } from "../../lib/researchClient";

interface DigestPanelProps {
  digest: ResearchDigest | null;
  streamingChunk: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</h3>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

export default function DigestPanel({ digest, streamingChunk }: DigestPanelProps) {
  if (!digest && !streamingChunk) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <div className="text-3xl mb-2">📋</div>
          <p>Research digest will appear here</p>
        </div>
      </div>
    );
  }

  // While streaming, show raw chunks
  if (!digest && streamingChunk) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-blue-600 font-medium">Generating digest…</span>
        </div>
        <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border border-slate-100">
          {streamingChunk}
        </pre>
      </div>
    );
  }

  if (!digest) return null;

  const confidencePct = Math.round(digest.confidence_score * 100);
  const barColor =
    confidencePct >= 80 ? "bg-green-500" : confidencePct >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="h-full overflow-y-auto space-y-1">
      {/* Topic */}
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800">{digest.topic}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{digest.papers_analyzed} papers analyzed</p>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Confidence</span>
          <span className="font-medium">{confidencePct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Key Findings */}
      {digest.key_findings.length > 0 && (
        <Section title="Key Findings">
          <ul className="space-y-1.5 list-none">
            {digest.key_findings.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-500 flex-shrink-0">▸</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Technical Insights */}
      {digest.technical_insights && (
        <Section title="Technical Insights">
          <ReactMarkdown>{digest.technical_insights}</ReactMarkdown>
        </Section>
      )}

      {/* Research Trends */}
      {digest.research_trends && (
        <Section title="Research Trends">
          <ReactMarkdown>{digest.research_trends}</ReactMarkdown>
        </Section>
      )}

      {/* Limitations */}
      {digest.limitations && (
        <Section title="Limitations">
          <ReactMarkdown>{digest.limitations}</ReactMarkdown>
        </Section>
      )}

      {/* Future Scope */}
      {digest.future_scope && (
        <Section title="Future Scope">
          <ReactMarkdown>{digest.future_scope}</ReactMarkdown>
        </Section>
      )}

      {/* Final Summary */}
      {digest.final_summary && (
        <Section title="Executive Summary">
          <p className="italic text-slate-600">{digest.final_summary}</p>
        </Section>
      )}
    </div>
  );
}
