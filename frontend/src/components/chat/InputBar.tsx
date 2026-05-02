import { useRef, useState, type KeyboardEvent } from "react";

interface InputBarProps {
  isLoading: boolean;
  onSend: (message: string) => void;
}

export function InputBar({ isLoading, onSend }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div
      className={`flex items-end gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all duration-150 ${
        isLoading
          ? "border-indigo-200"
          : "border-slate-200 focus-within:border-indigo-400 focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-100"
      }`}
    >
      <textarea
        ref={textareaRef}
        className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none leading-6 min-h-[24px] max-h-40"
        rows={1}
        placeholder={isLoading ? "Waiting for response…" : "Type a message… (Enter to send, Shift+Enter for newline)"}
        value={value}
        disabled={isLoading}
        onChange={(e) => {
          setValue(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
      />

      {/* Character hint */}
      {value.length > 200 && (
        <span className="text-[10px] text-slate-300 flex-shrink-0 self-center">
          {value.length}
        </span>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${
          isLoading
            ? "bg-indigo-100 text-indigo-400 cursor-not-allowed"
            : canSend
            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md active:scale-95"
            : "bg-slate-100 text-slate-300 cursor-not-allowed"
        }`}
      >
        {isLoading ? (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
