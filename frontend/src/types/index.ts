/**
 * Shared TypeScript interfaces for all API response shapes.
 * Import types from here — never define inline in components.
 */

// ── Auth ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ── Threads ────────────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Messages ───────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  thread_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// ── Attachments ────────────────────────────────────────────────────────────

export type AttachmentType = 'image' | 'video' | 'pdf' | 'excel' | 'code';

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  attachment_type: AttachmentType;
  url: string;
}

// ── API Responses ──────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
}
