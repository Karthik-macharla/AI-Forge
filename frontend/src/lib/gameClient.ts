/**
 * Tic Tac Toe — API client (Project 11)
 *
 * Uses the shared Axios instance from api.ts (cookie auth, /api proxy).
 * Follows the same pattern as nl2sqlClient.ts and researchClient.ts.
 */
import api from "./api";

// ── Types (mirror backend schemas/game.py) ─────────────────────────────────

export type CellValue = "X" | "O" | "";
export type Board = CellValue[][];
export type GameStatus = "in_progress" | "user_wins" | "ai_wins" | "draw";

export interface MoveRecord {
  move_number: number;
  player: "user" | "ai";
  row: number;
  col: number;
  reason?: string;
}

export interface Scores {
  wins: number;
  losses: number;
  draws: number;
}

export interface GameStartResponse {
  board: Board;
  status: GameStatus;
  user_symbol: string;
  ai_symbol: string;
  current_turn: "user" | "ai";
  scores: Scores;
  ai_move?: MoveRecord;
  message: string;
}

export interface MoveResponse {
  board: Board;
  status: GameStatus;
  current_turn: "user" | "ai";
  user_move: MoveRecord;
  ai_move?: MoveRecord;
  winner_cells: [number, number][];
  scores: Scores;
  message: string;
}

export interface GameRestartResponse {
  board: Board;
  status: GameStatus;
  current_turn: "user" | "ai";
  scores: Scores;
  message: string;
}

export interface GameHistoryResponse {
  moves: MoveRecord[];
  status: GameStatus;
  scores: Scores;
}

// ── API functions ──────────────────────────────────────────────────────────

export async function startGame(userSymbol: "X" | "O"): Promise<GameStartResponse> {
  const res = await api.post<GameStartResponse>("/game/start", {
    user_symbol: userSymbol,
  });
  return res.data;
}

export async function makeMove(row: number, col: number): Promise<MoveResponse> {
  const res = await api.post<MoveResponse>("/game/move", { row, col });
  return res.data;
}

export async function restartGame(keepScores = true): Promise<GameRestartResponse> {
  const res = await api.post<GameRestartResponse>("/game/restart", {
    keep_scores: keepScores,
  });
  return res.data;
}

export async function getHistory(): Promise<GameHistoryResponse> {
  const res = await api.get<GameHistoryResponse>("/game/history");
  return res.data;
}

export async function getScores(): Promise<Scores> {
  const res = await api.get<{ scores: Scores }>("/game/scores");
  return res.data.scores;
}
