import type { GameStatus } from "../../lib/gameClient";

interface GameControlsProps {
  gameStarted: boolean;
  status: GameStatus;
  currentTurn: "user" | "ai";
  userSymbol: "X" | "O" | null;
  isLoading: boolean;
  onStart: (symbol: "X" | "O") => void;
  onRestart: () => void;
}

const STATUS_BANNER: Record<string, { text: string; bg: string; text_color: string }> = {
  user_wins: { text: "🎉 You Win!", bg: "bg-emerald-50", text_color: "text-emerald-700" },
  ai_wins: { text: "🤖 AI Wins!", bg: "bg-rose-50", text_color: "text-rose-700" },
  draw: { text: "🤝 It's a Draw!", bg: "bg-amber-50", text_color: "text-amber-700" },
};

export function GameControls({
  gameStarted,
  status,
  currentTurn,
  userSymbol,
  isLoading,
  onStart,
  onRestart,
}: GameControlsProps) {
  // Pre-game: symbol selection
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-600 font-medium">Choose your symbol to start</p>
        <div className="flex gap-3">
          {(["X", "O"] as const).map((sym) => (
            <button
              key={sym}
              onClick={() => onStart(sym)}
              disabled={isLoading}
              className={`w-20 h-20 rounded-2xl border-2 text-3xl font-bold transition-all active:scale-95 disabled:opacity-50 ${
                sym === "X"
                  ? "border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
                  : "border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          X always goes first · AI uses the other symbol
        </p>
      </div>
    );
  }

  const banner = STATUS_BANNER[status];

  return (
    <div className="flex flex-col gap-3">
      {/* Status banner */}
      {banner ? (
        <div className={`px-4 py-3 rounded-xl border text-sm font-semibold text-center ${banner.bg} ${banner.text_color} border-current`}>
          {banner.text}
        </div>
      ) : (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium text-center transition-colors ${
          currentTurn === "user"
            ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
            : "bg-slate-50 text-slate-500 border border-slate-100"
        }`}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              AI is thinking…
            </span>
          ) : currentTurn === "user" ? (
            `Your turn (${userSymbol})`
          ) : (
            "AI's turn"
          )}
        </div>
      )}

      {/* Restart button */}
      <button
        onClick={onRestart}
        disabled={isLoading}
        className="w-full px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors active:scale-95 disabled:opacity-50"
      >
        Restart Game
      </button>
    </div>
  );
}
