import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { startResearchStream } from "../lib/researchClient";
import type { PaperCard as PaperCardType, ResearchDigest, StreamEvent } from "../lib/researchClient";
import { AgentLog, DigestPanel, PaperCard, SearchForm } from "../components/research";

export default function ResearchPage() {

  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [papers, setPapers] = useState<PaperCardType[]>([]);
  const [digest, setDigest] = useState<ResearchDigest | null>(null);
  const [streamingChunk, setStreamingChunk] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // Close EventSource on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  function handleSearch(query: string, maxPapers: number) {
    // Close any existing stream
    esRef.current?.close();

    // Reset state
    setEvents([]);
    setPapers([]);
    setDigest(null);
    setStreamingChunk("");
    setError(null);
    setIsLoading(true);

    const es = startResearchStream(query, maxPapers);
    esRef.current = es;

    // Handle each SSE event type
    const eventTypes = ["status", "tool_call", "thinking", "paper_found", "digest_chunk", "done", "error"];

    eventTypes.forEach((evType) => {
      es.addEventListener(evType, (e: MessageEvent) => {
        try {
          const streamEv: StreamEvent = JSON.parse(e.data);

          if (evType === "paper_found" && streamEv.metadata) {
            setPapers((prev) => [...prev, streamEv.metadata as unknown as PaperCardType]);
            setEvents((prev) => [...prev, streamEv]);
          } else if (evType === "digest_chunk") {
            setStreamingChunk((prev) => prev + streamEv.data);
          } else if (evType === "done") {
            if (streamEv.metadata) {
              setDigest(streamEv.metadata as unknown as ResearchDigest);
            }
            setStreamingChunk("");
            setIsLoading(false);
            es.close();
          } else if (evType === "error") {
            setError(streamEv.data);
            setIsLoading(false);
            es.close();
          } else {
            setEvents((prev) => [...prev, streamEv]);
          }
        } catch {
          // JSON parse error — ignore malformed event
        }
      });
    });

    es.onerror = () => {
      setError("Connection lost. Please try again.");
      setIsLoading(false);
      es.close();
    };
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6 flex-shrink-0">
        <span className="font-bold text-slate-800 text-sm">🔬 Research Digest Agent</span>
        <div className="flex gap-4 ml-auto text-sm">
          <Link to="/" className="text-slate-500 hover:text-slate-800 transition-colors">Chat</Link>
          <Link to="/nl2sql" className="text-slate-500 hover:text-slate-800 transition-colors">DB Q&A</Link>
          <Link to="/sheets" className="text-slate-500 hover:text-slate-800 transition-colors">Sheets</Link>
          <Link to="/research" className="text-blue-600 font-medium">Research</Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-6 py-6 gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Research Digest Agent</h1>
          <p className="text-sm text-slate-500 mt-1">
            Searches arXiv autonomously → delivers structured findings, insights, and paper summaries
          </p>
        </div>

        {/* Search form */}
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <span className="flex-1">⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-700 flex-shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main 2-column grid — AgentLog + DigestPanel */}
        {(events.length > 0 || isLoading || digest) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent log */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-h-[320px] flex flex-col">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Agent Activity
              </h2>
              <div className="flex-1 overflow-hidden">
                <AgentLog events={events} />
              </div>
            </div>

            {/* Digest panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-h-[320px] flex flex-col">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Research Digest
              </h2>
              <div className="flex-1 overflow-hidden">
                <DigestPanel digest={digest} streamingChunk={streamingChunk} />
              </div>
            </div>
          </div>
        )}

        {/* Papers section */}
        {papers.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Papers Found ({papers.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {papers.map((paper) => (
                <PaperCard key={paper.entry_id} paper={paper} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state after stream */}
        {!isLoading && !error && papers.length === 0 && events.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center text-slate-400 py-16">
            <div>
              <div className="text-5xl mb-4">🔬</div>
              <p className="text-lg font-medium text-slate-600 mb-1">Start a research query</p>
              <p className="text-sm">
                Type a research question above and the agent will search arXiv,<br />
                analyze papers, and generate a structured digest.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
