/**
 * NL2SQLPage — natural language to SQL query interface.
 *
 * Layout:
 *   Left sidebar  — Schema browser (collapsible)
 *   Main panel    — Question input + Results (SQL block + streaming answer + raw table)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { SchemaPanel } from '../components/nl2sql/SchemaPanel';
import { SQLBlock } from '../components/nl2sql/SQLBlock';
import { ResultTable } from '../components/nl2sql/ResultTable';
import { fetchSchema, queryNL2SQL } from '../lib/nl2sqlClient';
import type { SchemaResponse } from '../lib/nl2sqlClient';

// ── Example questions that rotate as placeholder text ─────────────────────

const EXAMPLE_QUESTIONS = [
  'Which department has the highest total salary budget?',
  'List the top 5 highest-paid employees with their department names.',
  'How many active projects are there per department?',
];

// ── State shape ────────────────────────────────────────────────────────────

interface QueryState {
  isLoading: boolean;
  generatedSQL: string | null;
  streamingAnswer: string;
  rows: Record<string, unknown>[];
  error: string | null;
  done: boolean;
}

const INITIAL_STATE: QueryState = {
  isLoading: false,
  generatedSQL: null,
  streamingAnswer: '',
  rows: [],
  error: null,
  done: false,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function NL2SQLPage() {
  const [question, setQuestion] = useState('');
  const [dbKey] = useState('main');
  const [queryState, setQueryState] = useState<QueryState>(INITIAL_STATE);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Rotate example placeholder text every 4 seconds
  useEffect(() => {
    const id = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % EXAMPLE_QUESTIONS.length),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  // Load schema on mount
  useEffect(() => {
    setSchemaLoading(true);
    fetchSchema(dbKey)
      .then(setSchema)
      .catch((e: unknown) => setSchemaError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSchemaLoading(false));
  }, [dbKey]);

  // Auto-scroll to bottom while streaming answer
  useEffect(() => {
    if (queryState.streamingAnswer) {
      answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [queryState.streamingAnswer]);

  const handleReset = useCallback(() => {
    setQueryState(INITIAL_STATE);
    setQuestion('');
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const q = question.trim();
    if (!q || queryState.isLoading) return;

    setQueryState({ ...INITIAL_STATE, isLoading: true });

    try {
      for await (const event of queryNL2SQL(q, dbKey)) {
        switch (event.type) {
          case 'sql':
            setQueryState((prev) => ({ ...prev, generatedSQL: event.sql }));
            break;

          case 'token':
            setQueryState((prev) => ({
              ...prev,
              streamingAnswer: prev.streamingAnswer + event.token,
            }));
            break;

          case 'rows':
            setQueryState((prev) => ({ ...prev, rows: event.rows }));
            break;

          case 'error':
            setQueryState((prev) => ({
              ...prev,
              isLoading: false,
              error: event.message,
            }));
            return;

          case 'done':
            setQueryState((prev) => ({
              ...prev,
              isLoading: false,
              done: true,
            }));
            break;
        }
      }
    } catch (err: unknown) {
      setQueryState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      }));
    }
  }, [question, dbKey, queryState.isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasResults =
    queryState.generatedSQL !== null ||
    queryState.streamingAnswer !== '' ||
    queryState.error !== null;

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      {/* ── Left sidebar: schema browser ──────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-slate-700 overflow-y-auto flex flex-col">
        <SchemaPanel schema={schema} isLoading={schemaLoading} error={schemaError} />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Chat
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Database Q&amp;A</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Ask questions in plain English — get SQL + an explanation
              </p>
            </div>
          </div>
          {hasResults && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          )}
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Question input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Your Question
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={EXAMPLE_QUESTIONS[placeholderIdx]}
                rows={3}
                disabled={queryState.isLoading}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">Press Ctrl+Enter to submit</p>
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || queryState.isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {queryState.isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Query
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {queryState.error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-300">{queryState.error}</p>
            </div>
          )}

          {/* SQL generation loading skeleton */}
          {queryState.isLoading && queryState.generatedSQL === null && (
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
              <div className="h-20 bg-slate-800 rounded-xl animate-pulse" />
            </div>
          )}

          {/* Generated SQL block */}
          {queryState.generatedSQL && (
            <SQLBlock sql={queryState.generatedSQL} />
          )}

          {/* Streaming answer */}
          {queryState.streamingAnswer && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm font-semibold text-slate-200">Answer</span>
                {queryState.isLoading && (
                  <span className="w-1.5 h-4 bg-blue-400 rounded-sm animate-pulse" />
                )}
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-justify">
                <ReactMarkdown>{queryState.streamingAnswer}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Raw data table — shown after streaming completes */}
          {queryState.done && queryState.rows.length > 0 && (
            <ResultTable rows={queryState.rows} />
          )}

          <div ref={answerEndRef} />
        </div>
      </main>
    </div>
  );
}
