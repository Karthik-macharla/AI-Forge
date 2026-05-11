import React from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../../types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onModifyImage?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastUserMsgRef?: { current: HTMLDivElement | null };
}

function formatTime(date?: Date) {
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function downloadImage(src: string) {
  const res = await fetch(src, { credentials: "include" });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `generated-image-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

function isExcel(name: string) {
  return name.toLowerCase().endsWith(".xlsx") || name.toLowerCase().endsWith(".xls");
}

function FileCard({ att }: { att: { id: string; name: string; previewUrl?: string } }) {
  const pdf = isPdf(att.name);
  const excel = isExcel(att.name);
  const url = `/api/attachments/${att.id}/file`;

  if (pdf) {
    return (
      <button
        onClick={() => window.open(url, "_blank")}
        className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 rounded-xl px-3 py-2 text-left transition-colors max-w-[200px]"
        title={`Preview ${att.name}`}
      >
        {/* PDF page icon */}
        <svg className="w-8 h-9 flex-shrink-0 text-red-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h2v2H8v-2zm0-3h8v1.5H8V12zm0-3h8v1.5H8V9z"/>
        </svg>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide">PDF</p>
          <p className="text-xs text-white truncate leading-tight">{att.name}</p>
          <p className="text-[10px] text-indigo-200 mt-0.5">Click to preview ↗</p>
        </div>
      </button>
    );
  }

  if (excel) {
    return (
      <button
        onClick={() => window.open(url, "_blank")}
        className="flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 border border-green-400/40 rounded-xl px-3 py-2 text-left transition-colors max-w-[200px]"
        title={`Preview ${att.name}`}
      >
        <svg className="w-8 h-9 flex-shrink-0 text-green-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 9h1.5l1.5 2.5L12.5 9H14l-2 3.5L14 16h-1.5L11 13.5 9.5 16H8l2-3.5L8 9z"/>
        </svg>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-green-300 uppercase tracking-wide">Excel</p>
          <p className="text-xs text-white truncate leading-tight">{att.name}</p>
          <p className="text-[10px] text-indigo-200 mt-0.5">Click to download ↗</p>
        </div>
      </button>
    );
  }

  // Generic file chip
  return (
    <div className="flex items-center gap-1.5 bg-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      {att.name}
    </div>
  );
}

export function MessageList({ messages, isLoading, onModifyImage, lastUserMsgRef }: MessageListProps) {
  // Index of the last user message — used to attach the scroll-anchor ref
  const lastUserIndex = messages.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1);

  return (
    <div className="px-4 py-6 space-y-6">
      {messages.map((msg, index) => {
        const isLastMsg = index === messages.length - 1;
        const showTyping = isLastMsg && msg.role === "assistant" && isLoading && !msg.content;
        const isUser = msg.role === "user";

        return (
          <div
            key={index}
            ref={isUser && index === lastUserIndex ? lastUserMsgRef : undefined}
            className={`flex items-end gap-2.5 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                isUser
                  ? "bg-indigo-600 text-white"
                  : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
              }`}
            >
              {isUser ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.537.22M14.25 3.104c.251.023.501.05.75.082M19.5 14.5l-4.091-4.091" />
                </svg>
              )}
            </div>

            {/* Bubble + timestamp */}
            <div
              className={`flex flex-col gap-1 max-w-[75%] ${
                isUser ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-br-sm shadow-sm"
                    : "bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100"
                }`}
              >
                {showTyping ? (
                  <TypingIndicator />
                ) : isUser ? (
                  <div className="flex flex-col gap-2">
                    {/* Uploaded attachment previews */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1">
                        {msg.attachments.map((att) =>
                          att.previewUrl ? (
                            <img
                              key={att.id}
                              src={att.previewUrl}
                              alt={att.name}
                              className="max-h-48 max-w-xs rounded-xl object-cover cursor-pointer shadow"
                              onClick={() => window.open(att.previewUrl, "_blank")}
                            />
                          ) : (
                            <FileCard key={att.id} att={att} />
                          )
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <p className="text-justify whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-justify [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0">
                      <ReactMarkdown
                      components={{
                        img: ({ src, alt }) => {
                          const isVideo = alt?.startsWith("video:");
                          if (isVideo) {
                            return (
                              <video
                                src={src}
                                controls
                                className="max-w-sm rounded-xl shadow-md mt-2"
                              />
                            );
                          }
                          // Generated image with download + modify overlay
                          return (
                            <span className="relative inline-block mt-2 group">
                              <img
                                src={src}
                                alt={alt ?? "Generated image"}
                                className="max-w-sm rounded-xl shadow-md block"
                              />
                              {/* Action buttons — appear on hover */}
                              <span className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Download */}
                                <button
                                  onClick={() => src && downloadImage(src)}
                                  title="Save image"
                                  className="flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg px-2 py-1 backdrop-blur-sm transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Save
                                </button>
                                {/* Modify */}
                                {onModifyImage && (
                                  <button
                                    onClick={onModifyImage}
                                    title="Modify with a new prompt"
                                    className="flex items-center gap-1 bg-indigo-600/80 hover:bg-indigo-700 text-white text-xs rounded-lg px-2 py-1 backdrop-blur-sm transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Modify
                                  </button>
                                )}
                                {/* Open full size */}
                                <button
                                  onClick={() => src && window.open(src, "_blank")}
                                  title="Open full size"
                                  className="flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg px-2 py-1 backdrop-blur-sm transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Full size
                                </button>
                              </span>
                            </span>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.timestamp && (
                <span className="text-[10px] text-slate-400 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 h-5 px-1">
      <span
        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
