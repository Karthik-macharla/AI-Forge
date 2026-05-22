import type { Board, CellValue } from "../../lib/gameClient";

interface GameBoardProps {
  board: Board;
  userSymbol: CellValue;
  winnerCells: [number, number][];
  disabled: boolean;
  onCellClick: (row: number, col: number) => void;
}

export function GameBoard({ board, userSymbol, winnerCells, disabled, onCellClick }: GameBoardProps) {
  const isWinnerCell = (r: number, c: number) =>
    winnerCells.some(([wr, wc]) => wr === r && wc === c);

  function cellStyle(value: CellValue, r: number, c: number) {
    const base =
      "w-24 h-24 flex items-center justify-center text-4xl font-bold rounded-2xl border-2 transition-all duration-150 select-none";
    if (isWinnerCell(r, c)) {
      return `${base} bg-emerald-100 border-emerald-400 scale-105 shadow-lg`;
    }
    if (value === "X") return `${base} bg-rose-50 border-rose-200 text-rose-600`;
    if (value === "O") return `${base} bg-indigo-50 border-indigo-200 text-indigo-600`;
    if (disabled) return `${base} bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed`;
    return `${base} bg-white border-slate-200 text-slate-400 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer active:scale-95`;
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {board.map((row, r) =>
        row.map((cell, c) => (
          <button
            key={`${r}-${c}`}
            className={cellStyle(cell, r, c)}
            onClick={() => !disabled && cell === "" && onCellClick(r, c)}
            disabled={disabled || cell !== ""}
            aria-label={`Cell row ${r} col ${c}${cell ? `: ${cell}` : " empty"}`}
          >
            {cell === "X" && (
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-rose-500" stroke="currentColor" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 6l12 12M18 6l-12 12" />
              </svg>
            )}
            {cell === "O" && (
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-indigo-500" stroke="currentColor" fill="none">
                <circle cx="12" cy="12" r="7" strokeWidth={2.5} />
              </svg>
            )}
          </button>
        ))
      )}
    </div>
  );
}
