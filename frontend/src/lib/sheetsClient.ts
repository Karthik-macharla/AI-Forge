/**
 * Sheets Query Agent API client — Project 9.
 * All fetch and streaming logic lives here. No direct fetch calls in components.
 */

export interface ColumnSummary {
  name: string;
  dtype: string;
}

export interface DataFrameSummary {
  row_count: number;
  col_count: number;
  columns: ColumnSummary[];
  preview: Record<string, unknown>[];
}

export interface SheetSummaryResponse {
  source: string;
  sheet_url: string;
  summary: DataFrameSummary;
}

/** Events emitted by the SSE stream parser — same pattern as nl2sqlClient.ts */
export type SheetsEvent =
  | { type: 'token'; token: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Load sheet metadata without asking a question yet. */
export async function fetchSheetSummary(
  sheetUrl: string,
): Promise<SheetSummaryResponse> {
  const res = await fetch('/api/sheets/summary-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sheet_url: sheetUrl, question: 'summary' }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: { message?: string } } | null;
    throw new Error(body?.detail?.message ?? `Failed to load sheet: ${res.statusText}`);
  }
  return res.json() as Promise<SheetSummaryResponse>;
}

/** Stream answer for a Google Sheet URL + question. */
export async function* querySheetUrl(
  sheetUrl: string,
  question: string,
): AsyncGenerator<SheetsEvent> {
  yield* _streamResponse('/api/sheets/query-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sheet_url: sheetUrl, question }),
  });
}

/** Stream answer for an uploaded .csv / .xlsx + question. */
export async function* queryUploadedFile(
  file: File,
  question: string,
): AsyncGenerator<SheetsEvent> {
  const form = new FormData();
  form.append('file', file);
  form.append('question', question);
  // Do NOT set Content-Type header — browser sets multipart boundary automatically
  yield* _streamResponse('/api/sheets/query-file', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
}

/** Shared SSE reader — same [DONE] / [ERROR] protocol as nl2sqlClient.ts */
async function* _streamResponse(
  url: string,
  init: RequestInit,
): AsyncGenerator<SheetsEvent> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    yield { type: 'error', message: String(err) };
    return;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: { message?: string } } | null;
    yield { type: 'error', message: body?.detail?.message ?? `Error: ${res.statusText}` };
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'Response not readable.' };
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // [ERROR]...[/ERROR] — check before [DONE]
    const errStart = buffer.indexOf('[ERROR]');
    const errEnd = buffer.indexOf('[/ERROR]');
    if (errStart !== -1 && errEnd > errStart) {
      yield { type: 'error', message: buffer.slice(errStart + 7, errEnd) };
      buffer = buffer.slice(errEnd + 8);
      continue;
    }

    // [DONE]
    const doneIdx = buffer.indexOf('[DONE]');
    if (doneIdx !== -1) {
      if (doneIdx > 0) yield { type: 'token', token: buffer.slice(0, doneIdx) };
      yield { type: 'done' };
      return;
    }

    // Partial marker guard — hold back the buffer tail if it looks like an incomplete marker
    const partials = ['[DONE', '[ERROR', '[/ERROR'];
    const hasPartial = partials.some((m) =>
      [...Array(m.length - 1).keys()].some((i) => buffer.endsWith(m.slice(0, i + 1))),
    );
    if (!hasPartial && buffer) {
      yield { type: 'token', token: buffer };
      buffer = '';
    }
  }
  if (buffer && buffer !== '[DONE]') yield { type: 'token', token: buffer };
  yield { type: 'done' };
}
