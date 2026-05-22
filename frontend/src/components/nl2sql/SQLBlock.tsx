/**
 * SQLBlock — syntax-highlighted SQL display with a Copy button and collapse toggle.
 */
import React, { useState } from 'react';

interface SQLBlockProps {
  sql: string;
}

export function SQLBlock({ sql }: SQLBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-sm font-semibold">Generated SQL</span>
          <svg
            className={`w-3 h-3 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-slate-700"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy SQL
            </>
          )}
        </button>
      </div>

      {/* SQL content */}
      {!collapsed && (
        <pre className="bg-slate-950 text-slate-100 text-sm font-mono px-4 py-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
          <code>
            {/* Simple keyword highlighting via spans */}
            {highlightSQL(sql)}
          </code>
        </pre>
      )}
    </div>
  );
}

// ── Very lightweight SQL keyword highlighter ───────────────────────────────

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'GROUP BY', 'ORDER BY',
  'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'LIKE', 'BETWEEN', 'EXISTS',
];

function highlightSQL(sql: string): React.ReactNode {
  // Tokenise by splitting on word boundaries around SQL keywords
  const regex = new RegExp(
    `(${KEYWORDS.map((k) => k.replace(/ /g, '\\s+')).join('|')})`,
    'gi',
  );
  const parts = sql.split(regex);
  return parts.map((part, i) => {
    const upper = part.trim().toUpperCase().replace(/\s+/g, ' ');
    if (KEYWORDS.includes(upper)) {
      return (
        <span key={i} className="text-blue-400 font-semibold">
          {part}
        </span>
      );
    }
    // String literals
    if (/^'.*'$/.test(part)) {
      return <span key={i} className="text-orange-300">{part}</span>;
    }
    // Numbers
    if (/^\d+(\.\d+)?$/.test(part.trim())) {
      return <span key={i} className="text-green-300">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}
