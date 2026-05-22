import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSheetSummary,
  querySheetUrl,
  queryUploadedFile,
  type DataFrameSummary,
} from '../lib/sheetsClient';

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = 'url' | 'file';

interface QueryState {
  isStreaming: boolean;
  answer: string;
  error: string | null;
  done: boolean;
}

const INITIAL_QUERY: QueryState = {
  isStreaming: false,
  answer: '',
  error: null,
  done: false,
};

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SheetsPage() {
  const navigate = useNavigate();

  // Data source state
  const [mode, setMode] = useState<Mode>('url');
  const [sheetUrl, setSheetUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<DataFrameSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Question + stream state
  const [question, setQuestion] = useState('');
  const [queryState, setQueryState] = useState<QueryState>(INITIAL_QUERY);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load sheet summary ─────────────────────────────────────────────────
  async function handleLoadSheet() {
    if (!sheetUrl.trim()) return;
    setIsLoadingSummary(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const res = await fetchSheetSummary(sheetUrl.trim());
      setSummary(res.summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingSummary(false);
    }
  }

  // ── File select ────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setUploadedFile(f);
    setSummary(null);
    setSummaryError(null);
    e.target.value = '';
  }

  // ── Ask question ───────────────────────────────────────────────────────
  async function handleAsk() {
    const q = question.trim();
    if (!q || queryState.isStreaming) return;
    if (mode === 'url' && !sheetUrl.trim()) return;
    if (mode === 'file' && !uploadedFile) return;

    setQueryState({ isStreaming: true, answer: '', error: null, done: false });

    const stream =
      mode === 'url'
        ? querySheetUrl(sheetUrl.trim(), q)
        : queryUploadedFile(uploadedFile!, q);

    try {
      for await (const event of stream) {
        if (event.type === 'token') {
          setQueryState((prev) => ({ ...prev, answer: prev.answer + event.token }));
        } else if (event.type === 'error') {
          setQueryState((prev) => ({
            ...prev,
            isStreaming: false,
            error: event.message,
            done: true,
          }));
          return;
        } else if (event.type === 'done') {
          break;
        }
      }
    } catch (err) {
      setQueryState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setQueryState((prev) => ({ ...prev, isStreaming: false, done: true }));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleAsk();
    }
  }

  function handleReset() {
    setQueryState(INITIAL_QUERY);
  }

  const canAsk =
    question.trim().length >= 3 &&
    !queryState.isStreaming &&
    (mode === 'url' ? !!sheetUrl.trim() : !!uploadedFile);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Chat
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M3 6h18M3 14h18M3 18h18" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Sheets Agent</p>
              <p className="text-xs text-slate-400">Ask questions about Google Sheets or CSV/XLSX files</p>
            </div>
          </div>
        </div>
      </header>

      {/* Body: two-column layout */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex gap-6">

        {/* ── Left panel: data source ──────────────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col gap-4">
          {/* Mode tabs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-200">
              {(['url', 'file'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSummary(null); setSummaryError(null); }}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                    mode === m
                      ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m === 'url' ? '🔗 Google Sheet URL' : '📁 Upload File'}
                </button>
              ))}
            </div>

            <div className="p-4 flex flex-col gap-3">
              {mode === 'url' ? (
                <>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                  />
                  <button
                    onClick={() => void handleLoadSheet()}
                    disabled={!sheetUrl.trim() || isLoadingSummary}
                    className="w-full py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoadingSummary ? 'Loading…' : 'Load Sheet'}
                  </button>
                  {summaryError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{summaryError}</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 text-xs font-medium border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                  >
                    {uploadedFile ? uploadedFile.name : 'Click to select .csv or .xlsx'}
                  </button>
                  {uploadedFile && (
                    <p className="text-[10px] text-slate-400 text-center">
                      {(uploadedFile.size / 1024).toFixed(1)} KB · ready
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Schema summary panel */}
          {summary && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600">
                  {summary.row_count.toLocaleString()} rows · {summary.col_count} columns
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {summary.columns.map((col) => (
                  <div key={col.name} className="px-4 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 font-mono truncate">{col.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">
                      {col.dtype}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Right panel: question + answer ───────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Question input */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            <label className="text-xs font-semibold text-slate-600">Your question</label>
            <textarea
              rows={3}
              placeholder="e.g. What is the total revenue by region? Which rows have missing values?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={queryState.isStreaming}
              className="w-full resize-none text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Ctrl + Enter to submit</p>
              <div className="flex items-center gap-2">
                {queryState.done && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => void handleAsk()}
                  disabled={!canAsk}
                  className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {queryState.isStreaming ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Thinking…
                    </>
                  ) : (
                    'Ask'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {queryState.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>Error: </strong>{queryState.error}
            </div>
          )}

          {/* Streaming answer */}
          {(queryState.answer || queryState.isStreaming) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-slate-600">Answer</p>
                {queryState.isStreaming && (
                  <span className="ml-auto text-[10px] text-emerald-500 animate-pulse">streaming…</span>
                )}
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {queryState.answer}
                  {queryState.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </pre>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!queryState.answer && !queryState.isStreaming && !queryState.error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Load a spreadsheet, then ask a question</p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Google Sheets, .csv, and .xlsx files
                </p>
              </div>
              <div className="mt-2 text-left max-w-sm w-full">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2 font-medium">Example questions</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    'What is the total and average of each numeric column?',
                    'Which rows have missing or empty values?',
                    'Show me the top 5 rows sorted by the first numeric column',
                    'How many unique values are in each column?',
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setQuestion(ex)}
                      className="text-xs text-left text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg px-3 py-1.5 border border-slate-200 hover:border-emerald-200 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
