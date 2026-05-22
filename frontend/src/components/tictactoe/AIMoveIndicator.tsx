interface AIMoveIndicatorProps {
  isThinking: boolean;
  lastReason?: string;
  lastAiMove?: { row: number; col: number };
}

export function AIMoveIndicator({ isThinking, lastReason, lastAiMove }: AIMoveIndicatorProps) {
  if (isThinking) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm">
        <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-medium">AI is thinking…</span>
      </div>
    );
  }

  if (!lastReason) return null;

  return (
    <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
      <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-400 font-medium uppercase tracking-wide">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        AI reasoning
        {lastAiMove && (
          <span className="ml-auto text-indigo-500 normal-case tracking-normal">
            → ({lastAiMove.row}, {lastAiMove.col})
          </span>
        )}
      </div>
      <p className="text-slate-600 leading-snug">{lastReason}</p>
    </div>
  );
}
