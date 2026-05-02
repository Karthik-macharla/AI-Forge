import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InputBar } from "../components/chat/InputBar";
import { MessageList } from "../components/chat/MessageList";
import { ThreadSidebar } from "../components/chat/ThreadSidebar";
import { authApi, messagesApi, streamChat, threadsApi } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { ChatMessage } from "../types/chat";

export default function ChatPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Server state: thread list ──────────────────────────────────────────
  const { data: threads = [], isLoading: isLoadingThreads } = useQuery({
    queryKey: ["threads"],
    queryFn: () => threadsApi.list().then((r) => r.data),
    enabled: !!user,
  });

  // ── Load messages when active thread changes ───────────────────────────
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    messagesApi.list(activeThreadId).then((r) => {
      setMessages(
        r.data.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
        }))
      );
    });
  }, [activeThreadId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Sidebar actions ────────────────────────────────────────────────────
  function handleNewThread() {
    setActiveThreadId(null);
    setMessages([]);
  }

  async function handleDeleteThread(id: string) {
    await threadsApi.delete(id);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
    }
  }

  async function handleRenameThread(id: string, title: string) {
    await threadsApi.rename(id, title);
    queryClient.invalidateQueries({ queryKey: ["threads"] });
  }

  async function handleLogout() {
    await authApi.logout();
    setUser(null);
  }

  // ── Send message ───────────────────────────────────────────────────────
  async function handleSend(message: string) {
    let threadId = activeThreadId;

    // Create a new thread if none is active
    if (!threadId) {
      const title = message.length > 60 ? message.slice(0, 60) + "…" : message;
      const res = await threadsApi.create(title);
      threadId = res.data.id;
      setActiveThreadId(threadId);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }

    // Append user bubble
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date() },
    ]);
    // Append empty assistant bubble
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      await streamChat(threadId, message, (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + token,
            };
          }
          return updated;
        });
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      // Refresh sidebar to bump updated_at ordering
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isLoadingThreads={isLoadingThreads}
        user={user}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
        onLogout={handleLogout}
      />

      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {activeThreadId ? (
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {threads.find((t) => t.id === activeThreadId)?.title ?? "Chat"}
                </p>
              ) : (
                <p className="text-sm font-semibold text-slate-800">New Chat</p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span className="text-xs text-slate-400">
                  Gemini 2.5 Flash · Online
                </span>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setActiveThreadId(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <WelcomeScreen onSend={handleSend} />
            ) : (
              <MessageList messages={messages} isLoading={isLoading} />
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input */}
        <div className="shrink-0 bg-white border-t border-slate-100">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <InputBar isLoading={isLoading} onSend={handleSend} />
            <p className="text-center text-[10px] text-slate-300 mt-2">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "💡", title: "Explain a concept", prompt: "Explain quantum computing in simple terms" },
  { icon: "✍️", title: "Help me write", prompt: "Write a professional email declining a meeting" },
  { icon: "🐍", title: "Write code", prompt: "Write a Python function to flatten a nested list" },
  { icon: "📋", title: "Summarize text", prompt: "What are the key principles of clean code?" },
];

function WelcomeScreen({ onSend }: { onSend: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mb-5">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">How can I help you today?</h2>
      <p className="text-sm text-slate-400 max-w-md">
        Ask me anything — I'm powered by Google Gemini and ready to assist.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSend(s.prompt)}
            className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all text-left group"
          >
            <span className="text-xl leading-none mt-0.5">{s.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                {s.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.prompt}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

