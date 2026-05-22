import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { digestApi } from '../lib/api';

const DISMISSED_KEY = 'digest_dismissed_run_date';

export function DigestBanner() {
  const [, forceUpdate] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['digest-latest'],
    queryFn: () => digestApi.latest().then((r) => r.data),
    staleTime: 60 * 1000,
    retry: false,
  });

  // Dismissed only for this specific digest — persists across page loads
  const isDismissed = !!data && localStorage.getItem(DISMISSED_KEY) === data.run_date;

  const dismiss = () => {
    if (data) {
      localStorage.setItem(DISMISSED_KEY, data.run_date);
      forceUpdate((n) => n + 1); // re-render to hide banner immediately
    }
  };

  if (isLoading || !data || isDismissed) return null;

  const date = new Date(data.run_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-xl border border-blue-500/30 bg-slate-800/95 shadow-2xl backdrop-blur-sm transition-all duration-300 ${
        expanded
          ? 'w-[560px] max-w-[calc(100vw-2rem)]'
          : 'w-96 max-w-[calc(100vw-2rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-lg">🔬</span>
          <div>
            <p className="text-sm font-semibold text-white">AI Research Digest</p>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
          {data.article_count != null && (
            <span className="ml-1 rounded-full bg-blue-600/20 border border-blue-500/30 px-2 py-0.5 text-xs text-blue-300">
              {data.article_count} articles
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Expand / collapse toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              /* collapse icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              /* expand icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div
        className={`px-4 py-3 overflow-y-auto transition-all duration-300 ${
          expanded ? 'max-h-[60vh]' : 'max-h-40'
        }`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
      >
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {data.digest_text}
        </p>
      </div>
    </div>
  );
}
