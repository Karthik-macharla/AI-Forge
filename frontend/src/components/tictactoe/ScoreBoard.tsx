import type { Scores } from "../../lib/gameClient";

interface ScoreBoardProps {
  scores: Scores;
  onResetScores: () => void;
}

export function ScoreBoard({ scores, onResetScores }: ScoreBoardProps) {
  const items = [
    { label: "Wins", value: scores.wins, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { label: "Losses", value: scores.losses, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
    { label: "Draws", value: scores.draws, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Score</h3>
        <button
          onClick={onResetScores}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        {items.map(({ label, value, color, bg, border }) => (
          <div key={label} className={`flex flex-col items-center py-4 ${bg} border-t ${border}`}>
            <span className={`text-3xl font-bold ${color}`}>{value}</span>
            <span className="text-xs text-slate-500 mt-1">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
