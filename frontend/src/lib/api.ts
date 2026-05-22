/**
 * Central API client.
 * All backend calls go through this module — never call fetch/axios directly in components.
 * The Vite dev server proxies /api/* to http://localhost:8000.
 */

import axios from 'axios';
import type { Thread, Message, User } from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  /** Register a new user with email + password. */
  register: (email: string, password: string, display_name: string) =>
    api.post<User>('/auth/register', { email, password, display_name }),

  /** Log in with email + password — sets httpOnly cookie. */
  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),

  /** Log out — clears the httpOnly cookie. */
  logout: () => api.post('/auth/logout'),

  /** Fetch the currently authenticated user (validates cookie). */
  me: () => api.get<User>('/auth/me'),

  /** Returns the Google OAuth redirect URL to begin the OAuth flow. */
  googleLoginUrl: () => api.get<{ url: string }>('/auth/google/login'),
};

// ── Threads ────────────────────────────────────────────────────────────────

export const threadsApi = {
  list: () => api.get<Thread[]>('/threads'),
  create: (title?: string) => api.post<Thread>('/threads', { title }),
  rename: (threadId: string, title: string) => api.put<Thread>(`/threads/${threadId}`, { title }),
  delete: (threadId: string) => api.delete(`/threads/${threadId}`),
};

// ── Messages ───────────────────────────────────────────────────────────────

export const messagesApi = {
  list: (threadId: string) =>
    api.get<Message[]>(`/threads/${threadId}/messages`),

  send: (threadId: string, content: string) =>
    api.post<Message>(`/threads/${threadId}/messages`, { content }),

  save: (threadId: string, messages: Array<{ role: string; content: string }>) =>
    api.post<{ saved: number }>(`/threads/${threadId}/messages/save`, messages),
};

// ── Health ─────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api.get<{ status: string; app: string; environment: string }>('/health'),
};

// ── Attachments ────────────────────────────────────────────────────────────

export const attachmentsApi = {
  upload: (threadId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('thread_id', threadId);
    return api.post<import('../types').Attachment>('/attachments/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  /** Fetch all attachments for a thread — used to restore message history after reload. */
  listByThread: (threadId: string) =>
    api.get<import('../types').Attachment[]>(`/threads/${threadId}/attachments`),
};

export default api;

// ── Images ────────────────────────────────────────────────────────────────

export interface ImageGenResponse {
  image_url: string;
  revised_prompt: string | null;
  message_id: string;
}

export const imageApi = {
  generate: (threadId: string, prompt: string) =>
    api.post<ImageGenResponse>('/images/generate', { thread_id: threadId, prompt }),
};

// ── Videos ────────────────────────────────────────────────────────────────

export interface VideoGenResponse {
  video_url: string;
  message_id: string;
}

export const videoApi = {
  generate: (threadId: string, prompt: string) =>
    api.post<VideoGenResponse>('/videos/generate', { thread_id: threadId, prompt }),
};

// ── RAG ───────────────────────────────────────────────────────────────────

export async function streamRag(
  question: string,
  threadId: string | null,
  onToken: (token: string) => void,
): Promise<void> {
  const response = await fetch("/api/rag/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question, thread_id: threadId }),
  });
  if (!response.ok) throw new Error(`RAG query failed: ${response.statusText}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onToken(decoder.decode(value, { stream: true }));
  }
}

// ── Chat Streaming ─────────────────────────────────────────────────────────

export async function streamChat(
  threadId: string,
  message: string,
  onToken: (token: string) => void,
  attachmentIds: string[] = [],
): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, thread_id: threadId, attachment_ids: attachmentIds }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onToken(decoder.decode(value, { stream: true }));
  }
}
