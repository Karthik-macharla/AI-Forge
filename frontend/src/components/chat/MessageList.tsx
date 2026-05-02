import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../../types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

function formatTime(date?: Date) {
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="px-4 py-6 space-y-6">
      {messages.map((msg, index) => {
        const isLastMsg = index === messages.length - 1;
        const showTyping = isLastMsg && msg.role === "assistant" && isLoading && !msg.content;
        const isUser = msg.role === "user";

        return (
          <div
            key={index}
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
                  <p className="text-justify whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="text-justify [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
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
