import { useState } from "react";

interface SearchFormProps {
  onSearch: (query: string, maxPapers: number) => void;
  isLoading: boolean;
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [maxPapers, setMaxPapers] = useState(10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || isLoading) return;
    onSearch(q, maxPapers);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Transformer architectures for protein folding…"
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 shadow-sm"
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 flex-shrink-0"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Researching…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Research
            </>
          )}
        </button>
      </div>

      {/* Max papers slider */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="flex-shrink-0">Papers to analyze:</span>
        <input
          type="range"
          min={5}
          max={20}
          value={maxPapers}
          onChange={(e) => setMaxPapers(Number(e.target.value))}
          disabled={isLoading}
          className="flex-1 accent-blue-600 disabled:opacity-50"
        />
        <span className="w-6 text-center font-medium text-slate-700">{maxPapers}</span>
      </div>
    </form>
  );
}
