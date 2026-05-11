export interface ChatAttachment {
  id: string;
  name: string;
  previewUrl?: string; // object URL for local preview, or /api/attachments/{id}/file
  mimeType?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  attachments?: ChatAttachment[];
}
