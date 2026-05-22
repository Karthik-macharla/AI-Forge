import { useEffect, useRef } from "react";
import type { StreamEvent } from "../../lib/researchClient";

interface AgentLogProps {
  events: StreamEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  tool_call: "🔍",
  thinking: "💭",
  paper_found: "📄",
  status: "⚙️",
  error: "❌",
  done: "✅",
  digest_chunk: "✍️",
};

const EVENT_COLORS: Record<string, string> = {
  tool_call: "text-blue-600 bg-blue-50 border-blue-100",
  thinking: "text-violet-600 bg-violet-50 border-violet-100",
  paper_found: "text-emerald-600 bg-emerald-50 border-emerald-100",
  status: "text-slate-600 bg-slate-50 border-slate-100",
  error: "text-red-600 bg-red-50 border-red-100",
  done: "text-green-600 bg-green-50 border-green-100",
  digest_chunk: "text-amber-600 bg-amber-50 border-amber-100",
};

export default function AgentLog({ events }: AgentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <div className="text-3xl mb-2">🤖</div>
          <p>Agent activity will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-2 pr-1">
      {events.map((ev, i) => {
        const icon = EVENT_ICONS[ev.event] ?? "•";
        const color = EVENT_COLORS[ev.event] ?? "text-slate-600 bg-slate-50 border-slate-100";
        return (
          <div
            key={i}
            className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${color}`}
          >
            <span className="flex-shrink-0 mt-0.5">{icon}</span>
            <span className="break-words min-w-0">{ev.data}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
