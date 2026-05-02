import { useRef, useState } from 'react';
import type { Thread, User } from '../../types';

interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  isLoadingThreads: boolean;
  user: User;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => Promise<void>;
  onLogout: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  isLoadingThreads,
  user,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onLogout,
}: ThreadSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  function startEdit(t: Thread, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(t.id);
    setEditValue(t.title);
    setTimeout(() => editRef.current?.select(), 0);
  }

  async function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== threads.find((t) => t.id === id)?.title) {
      await onRenameThread(id, trimmed);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <aside className="flex flex-col w-64 min-w-64 bg-slate-900 text-slate-100 h-screen shrink-0">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-white">Amzur AI Chat</span>
        </div>

        <button
          onClick={onNewThread}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoadingThreads ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-5 h-5 text-slate-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : threads.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8 px-4">
            No conversations yet.<br />Start a new chat!
          </p>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                activeThreadId === t.id
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              onClick={() => editingId !== t.id && onSelectThread(t.id)}
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>

              <div className="flex-1 min-w-0">
                {editingId === t.id ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(t.id); }
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onBlur={() => commitEdit(t.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-xs bg-slate-600 text-white rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                ) : (
                  <>
                    <p className="text-xs font-medium truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(t.updated_at)}</p>
                  </>
                )}
              </div>

              {editingId !== t.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  {/* Rename */}
                  <button
                    onClick={(e) => startEdit(t, e)}
                    className="p-0.5 rounded bg-transparent text-slate-400 hover:text-indigo-300 transition-colors"
                    aria-label="Rename thread"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
                    className="p-0.5 rounded bg-transparent text-slate-400 hover:text-red-400 transition-colors"
                    aria-label="Delete thread"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {(user.display_name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">
              {user.display_name ?? user.email.split('@')[0]}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
