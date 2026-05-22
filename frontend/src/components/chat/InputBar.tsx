import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";

export interface PendingAttachment {
  id: string;
  name: string;
  previewUrl?: string; // set for image/* files via URL.createObjectURL
}

// Must match backend ACCEPTED_MIME_TYPES in config.py
const ACCEPTED_MIMES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/x-python", "text/javascript",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_UPLOAD_MB = 20;

// Only document types that the RAG indexer can actually extract text from
const RAG_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/x-python",
  "text/javascript",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const RAG_ACCEPT = "application/pdf,text/plain,text/x-python,text/javascript,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.txt,.py,.js,.xlsx";

export type ToolMode = "image" | "video" | "rag" | "db" | "sheets" | "research";

const TOOL_CONFIG: Record<ToolMode, {
  label: string;
  placeholder: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  sendBg: string;
  icon: React.ReactNode;
}> = {
  image: {
    label: "Generate image",
    placeholder: "Describe the image you want to create…",
    chipBg: "bg-indigo-100",
    chipText: "text-indigo-700",
    chipBorder: "border-indigo-300",
    sendBg: "bg-indigo-600 hover:bg-indigo-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  video: {
    label: "Generate video",
    placeholder: "Describe the video you want to create…",
    chipBg: "bg-violet-100",
    chipText: "text-violet-700",
    chipBorder: "border-violet-300",
    sendBg: "bg-violet-600 hover:bg-violet-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  rag: {
    label: "Search my docs",
    placeholder: "What do you want to know from your documents?",
    chipBg: "bg-emerald-100",
    chipText: "text-emerald-700",
    chipBorder: "border-emerald-300",
    sendBg: "bg-emerald-600 hover:bg-emerald-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
    ),
  },
  db: {
    label: "Query database",
    placeholder: "Ask a question about the database… e.g. Who are the top 5 highest paid employees?",
    chipBg: "bg-amber-100",
    chipText: "text-amber-700",
    chipBorder: "border-amber-300",
    sendBg: "bg-amber-500 hover:bg-amber-600",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  sheets: {
    label: "Query sheet",
    placeholder: "Ask a question about the sheet… e.g. Which owner has the most items?",
    chipBg: "bg-teal-100",
    chipText: "text-teal-700",
    chipBorder: "border-teal-300",
    sendBg: "bg-teal-600 hover:bg-teal-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 6h18M3 14h18M3 18h18" />
      </svg>
    ),
  },
  research: {
    label: "Research digest",
    placeholder: "Enter a research topic… e.g. transformer attention mechanisms 2024",
    chipBg: "bg-purple-100",
    chipText: "text-purple-700",
    chipBorder: "border-purple-300",
    sendBg: "bg-purple-600 hover:bg-purple-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
};

interface InputBarProps {
  isLoading: boolean;
  onSend: (message: string) => void;
  onAttach?: (file: File) => void;
  onAttachError?: (message: string) => void;
  onGenerateImage?: (prompt: string) => void;
  onGenerateVideo?: (prompt: string) => void;
  onRagQuery?: (question: string) => void;
  onRagUpload?: (file: File) => void;
  onDbQuery?: (question: string) => void;
  onSheetsQuery?: (question: string, sheetUrl: string) => void;
  onResearchQuery?: (question: string) => void;
  attachments?: PendingAttachment[];
  onRemoveAttachment?: (id: string) => void;
}

export interface InputBarHandle {
  prefill(text: string): void;
  setMode(mode: ToolMode | null): void;
}

export const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar({
  isLoading,
  onSend,
  onAttach,
  onAttachError,
  onGenerateImage,
  onGenerateVideo,
  onRagQuery,
  onRagUpload,
  onDbQuery,
  onSheetsQuery,
  onResearchQuery,
  attachments = [],
  onRemoveAttachment,
}: InputBarProps, ref) {
  const [value, setValue] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [activeMode, setActiveMode] = useState<ToolMode | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const fileErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ragFileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    prefill(text: string) {
      setValue(text);
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) { el.focus(); el.selectionStart = el.selectionEnd = text.length; }
      }, 0);
    },
    setMode(mode: ToolMode | null) {
      setActiveMode(mode);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
  }));

  // Focus textarea when mode changes
  useEffect(() => {
    if (activeMode) setTimeout(() => textareaRef.current?.focus(), 0);
  }, [activeMode]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    if (activeMode === "image") onGenerateImage?.(trimmed);
    else if (activeMode === "video") onGenerateVideo?.(trimmed);
    else if (activeMode === "rag") onRagQuery?.(trimmed);
    else if (activeMode === "db") {
      // Stay in DB mode so the user can ask follow-up questions
      onDbQuery?.(trimmed);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    } else if (activeMode === "sheets") {
      // Stay in sheets mode with the URL intact so the user can ask follow-ups
      onSheetsQuery?.(trimmed, sheetUrl);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    } else if (activeMode === "research") {
      // Stay in research mode so the user can ask follow-up topics
      onResearchQuery?.(trimmed);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    } else onSend(trimmed);

    setValue("");
    setActiveMode(null);
    setSheetUrl("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && activeMode) { setActiveMode(null); setSheetUrl(""); }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }

  function handleRagFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!RAG_MIMES.has(file.type)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : "unknown";
        showFileError(`".${ext}" files can't be indexed for search. Allowed: PDF, text, Python, JavaScript, Excel.`);
        e.target.value = ""; return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        showFileError(`File exceeds the ${MAX_UPLOAD_MB} MB size limit.`);
        e.target.value = ""; return;
      }
      onRagUpload?.(file);
    }
    e.target.value = "";
  }

  function showFileError(msg: string) {
    setFileError(msg);
    if (fileErrorTimerRef.current) clearTimeout(fileErrorTimerRef.current);
    fileErrorTimerRef.current = setTimeout(() => setFileError(null), 4000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!ACCEPTED_MIMES.has(file.type)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : "unknown";
        showFileError(`".${ext}" files are not supported. Allowed: images, PDF, text, Excel, video.`);
        onAttachError?.(`File type '${file.type || file.name.split('.').pop()}' is not supported.`);
        e.target.value = ""; return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        showFileError(`File exceeds the ${MAX_UPLOAD_MB} MB size limit.`);
        onAttachError?.(`File exceeds the ${MAX_UPLOAD_MB} MB limit.`);
        e.target.value = ""; return;
      }
      onAttach?.(file);
    }
    e.target.value = "";
  }

  const DB_SAMPLES = [
    "How many tables are in the database?",
    "How many messages are there in total?",
    "Which thread has the most messages?",
    "Show all users with their email addresses",
    "How many chat threads exist?",
  ];

  const SHEETS_SAMPLES = [
    "How many rows are there?",
    "Who has the most items assigned?",
    "Show all items assigned to Karthik",
    "Show P1/Red Flag priority items",
    "List all unique values in the Assignee column",
  ];

  const RESEARCH_SAMPLES = [
    "Latest advances in transformer attention mechanisms",
    "How does RAG improve LLM accuracy?",
    "Recent breakthroughs in protein folding",
    "Diffusion models for image generation 2024",
    "Self-supervised learning survey",
  ];

  const cfg = activeMode ? TOOL_CONFIG[activeMode] : null;
  const canSend =
    value.trim().length > 0 &&
    !isLoading &&
    (activeMode !== "sheets" || sheetUrl.trim().startsWith("https://docs.google.com/spreadsheets"));
  const showTopBar = attachments.length > 0 || !!activeMode;

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm transition-all duration-150 ${
        isLoading
          ? "border-indigo-200"
          : cfg
          ? `${cfg.chipBorder} focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-100`
          : "border-slate-200 focus-within:border-indigo-400 focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-100"
      }`}
    >
      {/* Top bar: attachment chips (left) + active tool chip (right) */}
      {showTopBar && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3 flex-wrap">
          {/* Attachment chips */}
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 text-xs text-indigo-700 max-w-[200px]"
              >
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                ) : (
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
                <span className="truncate">{att.name}</span>
                <button onClick={() => onRemoveAttachment?.(att.id)} className="flex-shrink-0 text-indigo-400 hover:text-indigo-700 transition-colors" aria-label={`Remove ${att.name}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Sample questions — shown when DB, Sheets, or Research mode is active and input is empty */}
          {(activeMode === "db" || activeMode === "sheets" || activeMode === "research") && !value.trim() && (
            <div className="w-full flex flex-wrap gap-1.5 mt-2">
              {(activeMode === "db" ? DB_SAMPLES : activeMode === "sheets" ? SHEETS_SAMPLES : RESEARCH_SAMPLES).map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => { setValue(sample); setTimeout(() => textareaRef.current?.focus(), 0); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    activeMode === "db"
                      ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                      : activeMode === "sheets"
                      ? "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
                      : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  {sample}
                </button>
              ))}
            </div>
          )}

          {/* Sheet URL input — only visible in sheets mode */}
          {activeMode === "sheets" && (
            <div className="w-full flex items-center gap-2 mt-2 mb-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-teal-500" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="Paste Google Sheet URL…"
                className="flex-1 text-xs bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-colors"
              />
            </div>
          )}

          {/* Active tool chip — right-aligned */}
          {cfg && activeMode && (
            <div className={`flex items-center gap-1.5 ${cfg.chipBg} ${cfg.chipText} border ${cfg.chipBorder} rounded-full pl-2.5 pr-1.5 py-1 text-xs font-medium flex-shrink-0 ml-auto`}>
              {cfg.icon}
              <span>{cfg.label}</span>
              <button
                onClick={() => { setActiveMode(null); setValue(""); setSheetUrl(""); }}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                aria-label="Cancel mode"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3 px-4 py-3">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/x-python,text/javascript,video/mp4,video/webm,video/ogg,video/quicktime,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.jpg,.png,.gif,.webp,.pdf,.txt,.py,.js,.mp4,.webm,.ogv,.mov,.xlsx"
          onChange={handleFileChange}
        />
        {/* RAG-only file input — documents only, no images/videos */}
        <input
          ref={ragFileInputRef}
          type="file"
          className="hidden"
          accept={RAG_ACCEPT}
          onChange={handleRagFileChange}
        />

        {/* + button with dropdown */}
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            disabled={isLoading}
            aria-label="Attach or generate"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
              isLoading ? "text-slate-300 cursor-not-allowed"
              : showMenu ? "bg-indigo-100 text-indigo-600"
              : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 min-w-[180px] z-30">
              <button onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Upload file
              </button>
              <button onClick={() => { setShowMenu(false); ragFileInputRef.current?.click(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors text-left">
                <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1">Upload to docs</span>
                <span className="text-[10px] text-emerald-500 font-medium">RAG</span>
              </button>
              <div className="h-px bg-slate-100 mx-3 my-1" />
              {(["image", "video", "rag", "db", "sheets", "research"] as ToolMode[]).map((mode) => {
                const t = TOOL_CONFIG[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => { setShowMenu(false); setActiveMode(mode); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                      activeMode === mode ? `${t.chipBg} ${t.chipText} font-medium` : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className={activeMode === mode ? t.chipText : "text-slate-500"}>{t.icon}</span>
                    {t.label}
                    {activeMode === mode && <span className="ml-auto text-[10px] opacity-60">active</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none leading-6 min-h-[24px] max-h-40"
          rows={1}
          placeholder={isLoading ? "Waiting for response…" : cfg ? cfg.placeholder : "Type a message… (Enter to send, Shift+Enter for newline)"}
          value={value}
          disabled={isLoading}
          onChange={(e) => { setValue(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
        />

        {value.length > 200 && (
          <span className="text-[10px] text-slate-300 flex-shrink-0 self-center">{value.length}</span>
        )}

        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${
            isLoading ? "bg-indigo-100 text-indigo-400 cursor-not-allowed"
            : canSend ? `${cfg ? cfg.sendBg : "bg-indigo-600 hover:bg-indigo-700"} text-white shadow-sm hover:shadow-md active:scale-95`
            : "bg-slate-100 text-slate-300 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Inline file validation error — appears immediately on bad file selection */}
      {fileError && (
        <div className="flex items-center gap-2 mx-4 mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <svg className="w-3.5 h-3.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="flex-1">{fileError}</span>
          <button
            onClick={() => { setFileError(null); if (fileErrorTimerRef.current) clearTimeout(fileErrorTimerRef.current); }}
            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});
