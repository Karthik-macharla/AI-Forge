/**
 * ResultTable — renders raw query result rows as a styled HTML table.
 * Hidden until the answer stream completes.
 */
import { useState } from 'react';

interface ResultTableProps {
  rows: Record<string, unknown>[];
}

export function ResultTable({ rows }: ResultTableProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 text-left hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          <span className="text-sm font-semibold">Raw Data</span>
          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-800">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-700 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-900">
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2 text-slate-300 font-mono text-xs border-b border-slate-800 whitespace-nowrap"
                    >
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    // Format large integers with commas
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  return String(val);
}
