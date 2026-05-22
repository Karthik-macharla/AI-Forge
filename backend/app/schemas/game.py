"""
Pydantic schemas for Project 11 — Tic Tac Toe.

Follows the same pattern as app/schemas/nl2sql.py and app/schemas/research.py.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Board = list[list[str]]  # 3×3 list of "", "X", "O"

GameStatus = Literal["in_progress", "user_wins", "ai_wins", "draw"]


# ── Request models ─────────────────────────────────────────────────────────

class GameStartRequest(BaseModel):
    user_symbol: Literal["X", "O"] = Field(
        default="X",
        description="Symbol the human player wants to use. AI always uses the other.",
    )


class MoveRequest(BaseModel):
    row: int = Field(..., ge=0, le=2, description="Row index 0–2")
    col: int = Field(..., ge=0, le=2, description="Column index 0–2")


class GameRestartRequest(BaseModel):
    keep_scores: bool = Field(default=True, description="Preserve win/loss/draw counts.")


# ── Response models ────────────────────────────────────────────────────────

class Scores(BaseModel):
    wins: int = 0
    losses: int = 0
    draws: int = 0


class MoveRecord(BaseModel):
    move_number: int
    player: Literal["user", "ai"]
    row: int
    col: int
    reason: Optional[str] = None  # only set for AI moves


class GameStartResponse(BaseModel):
    board: Board
    status: GameStatus
    user_symbol: str
    ai_symbol: str
    current_turn: Literal["user", "ai"]
    scores: Scores
    ai_move: Optional[MoveRecord] = None   # set when user picks "O" (AI goes first)
    message: str


class MoveResponse(BaseModel):
    board: Board
    status: GameStatus
    current_turn: Literal["user", "ai"]
    user_move: MoveRecord
    ai_move: Optional[MoveRecord] = None  # None when game is over after user move
    winner_cells: list[tuple[int, int]] = Field(default_factory=list)
    scores: Scores
    message: str


class GameRestartResponse(BaseModel):
    board: Board
    status: GameStatus
    current_turn: Literal["user", "ai"]
    scores: Scores
    message: str


class GameHistoryResponse(BaseModel):
    moves: list[MoveRecord]
    status: GameStatus
    scores: Scores


class ScoresResponse(BaseModel):
    scores: Scores
