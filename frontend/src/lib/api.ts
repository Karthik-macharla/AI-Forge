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
};

// ── Health ─────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api.get<{ status: string; app: string; environment: string }>('/health'),
};

export default api;

// ── Chat Streaming ─────────────────────────────────────────────────────────

export async function streamChat(
  threadId: string,
  message: string,
  onToken: (token: string) => void,
): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, thread_id: threadId }),
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
