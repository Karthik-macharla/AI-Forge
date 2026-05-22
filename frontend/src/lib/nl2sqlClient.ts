/**
 * NL2SQL API client.
 * All fetch/stream logic for the NL2SQL feature lives here — never call fetch
 * directly in components.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableInfo {
  name: string;
  row_count: number;
  columns: ColumnInfo[];
}

export interface SchemaResponse {
  dialect: string;
  db_key: string;
  tables: TableInfo[];
}

export interface HistoryEntry {
  id: string;
  question: string;
  generated_sql: string;
  answer: string;
  db_key: string;
  row_count: number;
  created_at: string;
}

export interface HistoryResponse {
  history: HistoryEntry[];
  total: number;
}

/** Events emitted by the SSE stream parser. */
export type NL2SQLEvent =
  | { type: 'sql'; sql: string }
  | { type: 'token'; token: string }
  | { type: 'rows'; rows: Record<string, unknown>[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

// ── Schema API ─────────────────────────────────────────────────────────────

export async function fetchSchema(dbKey = 'main'): Promise<SchemaResponse> {
  const res = await fetch(`/api/nl2sql/schema?db_key=${encodeURIComponent(dbKey)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.message ?? `Schema fetch failed: ${res.statusText}`);
  }
  return res.json() as Promise<SchemaResponse>;
}

// ── History API ────────────────────────────────────────────────────────────

export async function fetchHistory(limit = 20): Promise<HistoryResponse> {
  const res = await fetch(`/api/nl2sql/history?limit=${limit}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.message ?? `History fetch failed: ${res.statusText}`);
  }
  return res.json() as Promise<HistoryResponse>;
}

// ── Query stream ───────────────────────────────────────────────────────────

/**
 * Stream a NL2SQL query. Returns an AsyncIterator of typed NL2SQLEvent objects.
 *
 * Stream protocol from backend:
 *   [SQL]<sql>[/SQL]   — one chunk: the generated SQL
 *   <token>...         — answer tokens
 *   [DONE]             — end of stream
 *   [ERROR]<msg>[/ERROR] — error from backend
 */
export async function* queryNL2SQL(
  question: string,
  dbKey = 'main',
): AsyncGenerator<NL2SQLEvent> {
  const res = await fetch('/api/nl2sql/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ question, db_key: dbKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.detail?.message ?? `Query failed: ${res.statusText}`;
    yield { type: 'error', message: msg };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'Response body is not readable.' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process all complete markers from the buffer.
    // IMPORTANT: multi-character paired markers ([ERROR], [ROWS], [SQL]) MUST be
    // checked before [DONE], because if they arrive in the same read() chunk as
    // [DONE] the paired marker would otherwise be emitted as raw token text.
    let processed = true;
    while (processed) {
      processed = false;

      // [ERROR]...[/ERROR]  — check BEFORE [DONE]
      const errStart = buffer.indexOf('[ERROR]');
      const errEnd = buffer.indexOf('[/ERROR]');
      if (errStart !== -1 && errEnd !== -1 && errEnd > errStart) {
        const before = buffer.slice(0, errStart);
        if (before) yield { type: 'token', token: before };
        const msg = buffer.slice(errStart + '[ERROR]'.length, errEnd);
        yield { type: 'error', message: msg };
        buffer = buffer.slice(errEnd + '[/ERROR]'.length);
        processed = true;
        continue;
      }

      // [ROWS]...[/ROWS]  — check BEFORE [DONE]
      const rowsStart = buffer.indexOf('[ROWS]');
      const rowsEnd = buffer.indexOf('[/ROWS]');
      if (rowsStart !== -1 && rowsEnd !== -1 && rowsEnd > rowsStart) {
        const before = buffer.slice(0, rowsStart);
        if (before) yield { type: 'token', token: before };
        const rowsJson = buffer.slice(rowsStart + '[ROWS]'.length, rowsEnd);
        try {
          const rows = JSON.parse(rowsJson) as Record<string, unknown>[];
          yield { type: 'rows', rows };
        } catch {
          // Malformed JSON — skip silently
        }
        buffer = buffer.slice(rowsEnd + '[/ROWS]'.length);
        processed = true;
        continue;
      }

      // [SQL]...[/SQL]  — check BEFORE [DONE]
      const sqlStart = buffer.indexOf('[SQL]');
      const sqlEnd = buffer.indexOf('[/SQL]');
      if (sqlStart !== -1 && sqlEnd !== -1 && sqlEnd > sqlStart) {
        const before = buffer.slice(0, sqlStart);
        if (before) yield { type: 'token', token: before };
        const sql = buffer.slice(sqlStart + '[SQL]'.length, sqlEnd);
        yield { type: 'sql', sql };
        buffer = buffer.slice(sqlEnd + '[/SQL]'.length);
        processed = true;
        continue;
      }

      // [DONE]  — always checked last so paired markers are extracted first
      const doneIdx = buffer.indexOf('[DONE]');
      if (doneIdx !== -1) {
        const before = buffer.slice(0, doneIdx);
        if (before) yield { type: 'token', token: before };
        yield { type: 'done' };
        buffer = buffer.slice(doneIdx + '[DONE]'.length);
        processed = true;
        continue;
      }

      // If a partial marker is in the buffer, wait for more data
      const partialMarkers = ['[SQL', '[/SQL', '[DONE', '[ERROR', '[/ERROR', '[ROWS', '[/ROWS'];
      const hasPartial = partialMarkers.some((m) => {
        for (let i = 1; i < m.length; i++) {
          if (buffer.endsWith(m.slice(0, i))) return true;
        }
        return false;
      });

      if (!hasPartial && buffer) {
        // Safe to emit remaining buffer content as token
        yield { type: 'token', token: buffer };
        buffer = '';
        processed = true;
      }
    }
  }

  // Flush any remaining content
  if (buffer && buffer !== '[DONE]') {
    yield { type: 'token', token: buffer };
  }
  yield { type: 'done' };
}
