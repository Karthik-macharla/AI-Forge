/**
 * SchemaPanel — collapsible sidebar showing database tables and columns.
 */
import { useState } from 'react';
import type { SchemaResponse, TableInfo } from '../../lib/nl2sqlClient';

interface SchemaPanelProps {
  schema: SchemaResponse | null;
  isLoading: boolean;
  error: string | null;
}

function TableRow({ table }: { table: TableInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-750 text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Table icon */}
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          <span className="text-sm font-mono text-slate-200 truncate">{table.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">{table.row_count.toLocaleString()} rows</span>
          <svg
            className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="bg-slate-900 px-3 py-2 space-y-1">
          {table.columns.map((col) => (
            <div key={col.name} className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-300">{col.name}</span>
              <span className="text-xs text-slate-500 truncate max-w-[110px] text-right">{col.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaPanel({ schema, isLoading, error }: SchemaPanelProps) {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <button
        onClick={() => setPanelOpen((p) => !p)}
        className="flex items-center justify-between px-4 py-3 border-b border-slate-700 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <span className="text-sm font-semibold text-slate-200">Schema Browser</span>
          {schema && (
            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
              {schema.tables.length} tables
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${panelOpen ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {panelOpen && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <p className="text-xs text-red-400 px-1">{error}</p>
          )}

          {schema && !isLoading && schema.tables.map((table) => (
            <TableRow key={table.name} table={table} />
          ))}

          {schema && (
            <p className="text-xs text-slate-600 px-1 pt-1">
              Dialect: {schema.dialect} · DB: {schema.db_key}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
