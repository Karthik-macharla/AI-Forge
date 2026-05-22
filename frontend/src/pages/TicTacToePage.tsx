import { useState } from "react";
import { Link } from "react-router-dom";
import {
  startGame,
  makeMove,
  restartGame,
  type Board,
  type GameStatus,
  type MoveRecord,
  type Scores,
} from "../lib/gameClient";
import { GameBoard, AIMoveIndicator, ScoreBoard, GameControls } from "../components/tictactoe";

const EMPTY_BOARD: Board = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];

export default function TicTacToePage() {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [status, setStatus] = useState<GameStatus>("in_progress");
  const [currentTurn, setCurrentTurn] = useState<"user" | "ai">("user");
  const [userSymbol, setUserSymbol] = useState<"X" | "O" | null>(null);
  const [winnerCells, setWinnerCells] = useState<[number, number][]>([]);
  const [scores, setScores] = useState<Scores>({ wins: 0, losses: 0, draws: 0 });
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [lastAiReason, setLastAiReason] = useState<string | undefined>();
  const [lastAiMove, setLastAiMove] = useState<{ row: number; col: number } | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  // ── Start ────────────────────────────────────────────────────────────────
  async function handleStart(symbol: "X" | "O") {
    setIsLoading(true);
    setError(null);
    try {
      const res = await startGame(symbol);
      setBoard(res.board);
      setStatus(res.status);
      setCurrentTurn(res.current_turn);
      setUserSymbol(symbol);
      setScores(res.scores);
      setWinnerCells([]);
      setMoveHistory([]);
      setLastAiReason(undefined);
      setLastAiMove(undefined);
      setGameStarted(true);

      // If AI moved first (user chose O)
      if (res.ai_move) {
        setMoveHistory([res.ai_move]);
        setLastAiReason(res.ai_move.reason);
        setLastAiMove({ row: res.ai_move.row, col: res.ai_move.col });
      }
    } catch {
      setError("Failed to start game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── User move ────────────────────────────────────────────────────────────
  async function handleCellClick(row: number, col: number) {
    if (isLoading || status !== "in_progress" || currentTurn !== "user") return;
    setIsLoading(true);
    setError(null);
    setLastAiReason(undefined);
    setLastAiMove(undefined);

    try {
      const res = await makeMove(row, col);
      setBoard(res.board);
      setStatus(res.status);
      setCurrentTurn(res.current_turn);
      setWinnerCells(res.winner_cells ?? []);
      setScores(res.scores);

      const newHistory = [...moveHistory, res.user_move];
      if (res.ai_move) {
        newHistory.push(res.ai_move);
        setLastAiReason(res.ai_move.reason);
        setLastAiMove({ row: res.ai_move.row, col: res.ai_move.col });
      }
      setMoveHistory(newHistory);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })
          ?.response?.data?.detail?.message ?? "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Restart ──────────────────────────────────────────────────────────────
  async function handleRestart() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await restartGame(true);
      setBoard(res.board);
      setStatus(res.status);
      setCurrentTurn(res.current_turn);
      setScores(res.scores);
      setWinnerCells([]);
      setMoveHistory([]);
      setLastAiReason(undefined);
      setLastAiMove(undefined);
    } catch {
      setError("Failed to restart. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Reset scores ─────────────────────────────────────────────────────────
  async function handleResetScores() {
    setIsLoading(true);
    try {
      const res = await restartGame(false);
      setBoard(res.board);
      setStatus(res.status);
      setCurrentTurn(res.current_turn);
      setScores(res.scores);
      setWinnerCells([]);
      setMoveHistory([]);
      setLastAiReason(undefined);
      setLastAiMove(undefined);
    } catch {
      setError("Failed to reset scores.");
    } finally {
      setIsLoading(false);
    }
  }

  const boardDisabled =
    isLoading || status !== "in_progress" || currentTurn !== "user" || !gameStarted;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-800">Tic Tac Toe — AI Agent</h1>
            <p className="text-xs text-slate-400">Powered by Gemini · Project 11</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-xs text-slate-400">AI Online</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Board + Controls */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Game board */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center gap-6">
              <GameBoard
                board={board}
                userSymbol={userSymbol ?? "X"}
                winnerCells={winnerCells}
                disabled={boardDisabled}
                onCellClick={handleCellClick}
              />

              <div className="w-full max-w-xs">
                <GameControls
                  gameStarted={gameStarted}
                  status={status}
                  currentTurn={currentTurn}
                  userSymbol={userSymbol}
                  isLoading={isLoading}
                  onStart={handleStart}
                  onRestart={handleRestart}
                />
              </div>
            </div>

            {/* AI reasoning */}
            <AIMoveIndicator
              isThinking={isLoading && currentTurn === "ai"}
              lastReason={lastAiReason}
              lastAiMove={lastAiMove}
            />
          </div>

          {/* Right: Score + History */}
          <div className="flex flex-col gap-4">
            <ScoreBoard scores={scores} onResetScores={handleResetScores} />

            {/* Move history */}
            {moveHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">Move History</h3>
                </div>
                <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {[...moveHistory].reverse().map((m) => (
                    <li key={m.move_number} className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            m.player === "user"
                              ? "bg-rose-100 text-rose-600"
                              : "bg-indigo-100 text-indigo-600"
                          }`}
                        >
                          {m.move_number}
                        </span>
                        <span className="font-medium text-slate-600 capitalize">{m.player}</span>
                        <span className="text-slate-400">→ ({m.row}, {m.col})</span>
                      </div>
                      {m.reason && (
                        <p className="text-slate-400 pl-7 leading-snug">{m.reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
