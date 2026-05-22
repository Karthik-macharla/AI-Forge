"""
Game service — Project 11: Tic Tac Toe.

Manages game state per user session (in-memory, keyed by user_id).
Handles move validation, win/draw detection, and AI turn coordination.

Follows the same pattern as app/services/nl2sql_service.py.
"""
import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional

from app.ai.agents.tic_tac_toe_agent import get_ai_move
from app.core.logging import logger
from app.schemas.game import Board, GameStatus, MoveRecord, Scores

# ── Win patterns ───────────────────────────────────────────────────────────
_WIN_LINES: list[list[tuple[int, int]]] = [
    # rows
    [(0, 0), (0, 1), (0, 2)],
    [(1, 0), (1, 1), (1, 2)],
    [(2, 0), (2, 1), (2, 2)],
    # columns
    [(0, 0), (1, 0), (2, 0)],
    [(0, 1), (1, 1), (2, 1)],
    [(0, 2), (1, 2), (2, 2)],
    # diagonals
    [(0, 0), (1, 1), (2, 2)],
    [(0, 2), (1, 1), (2, 0)],
]


def _empty_board() -> Board:
    return [["", "", ""], ["", "", ""], ["", "", ""]]


def _check_winner(board: Board) -> tuple[Optional[str], list[tuple[int, int]]]:
    """Return (winning_symbol, winning_cells) or (None, []) if no winner yet."""
    for line in _WIN_LINES:
        values = [board[r][c] for r, c in line]
        if values[0] and values[0] == values[1] == values[2]:
            return values[0], list(line)
    return None, []


def _is_draw(board: Board) -> bool:
    return all(cell != "" for row in board for cell in row)


# ── In-memory session store ────────────────────────────────────────────────

@dataclass
class _GameSession:
    user_id: uuid.UUID
    board: Board = field(default_factory=_empty_board)
    user_symbol: str = "X"
    ai_symbol: str = "O"
    current_turn: Literal["user", "ai"] = "user"
    status: GameStatus = "in_progress"
    winner_cells: list[tuple[int, int]] = field(default_factory=list)
    move_history: list[MoveRecord] = field(default_factory=list)
    scores: Scores = field(default_factory=Scores)
    move_counter: int = 0


# user_id (str) → _GameSession
_sessions: dict[str, _GameSession] = {}


def _get_or_create(user_id: uuid.UUID) -> _GameSession:
    key = str(user_id)
    if key not in _sessions:
        _sessions[key] = _GameSession(user_id=user_id)
    return _sessions[key]


# ── Public API ─────────────────────────────────────────────────────────────

def start_game(user_id: uuid.UUID, user_symbol: str) -> _GameSession:
    """Initialise (or re-use) a session and set the user's chosen symbol."""
    key = str(user_id)
    session = _sessions.get(key)

    if session is None:
        session = _GameSession(user_id=user_id)
        _sessions[key] = session
    else:
        # Keep scores, reset board only
        session.board = _empty_board()
        session.status = "in_progress"
        session.winner_cells = []
        session.move_history = []
        session.move_counter = 0

    session.user_symbol = user_symbol
    session.ai_symbol = "O" if user_symbol == "X" else "X"
    # If user chose O, AI (X) goes first
    session.current_turn = "ai" if user_symbol == "O" else "user"
    logger.info("Game started: user=%s symbol=%s ai_goes_first=%s", user_id, user_symbol, session.current_turn == "ai")
    return session


def validate_user_move(session: _GameSession, row: int, col: int) -> Optional[str]:
    """Return an error string, or None if the move is legal."""
    if session.status != "in_progress":
        return "Game is already over."
    if session.current_turn != "user":
        return "It is not your turn."
    if not (0 <= row <= 2 and 0 <= col <= 2):
        return "Row and column must be between 0 and 2."
    if session.board[row][col] != "":
        return "That cell is already occupied."
    return None


def apply_user_move(session: _GameSession, row: int, col: int) -> MoveRecord:
    """Apply the user's move to the board. Returns the recorded move."""
    session.move_counter += 1
    session.board[row][col] = session.user_symbol
    record = MoveRecord(
        move_number=session.move_counter,
        player="user",
        row=row,
        col=col,
    )
    session.move_history.append(record)

    winner, cells = _check_winner(session.board)
    if winner == session.user_symbol:
        session.status = "user_wins"
        session.winner_cells = cells
        session.scores.wins += 1
        session.current_turn = "user"  # game over
    elif _is_draw(session.board):
        session.status = "draw"
        session.scores.draws += 1
        session.current_turn = "user"
    else:
        session.current_turn = "ai"

    return record


async def apply_ai_move(session: _GameSession) -> MoveRecord:
    """Ask the agent for a move, apply it, and return the recorded move."""
    if session.status != "in_progress":
        raise ValueError("Cannot make AI move — game is over.")

    ai_result = await get_ai_move(session.board)
    row, col, reason = ai_result["row"], ai_result["col"], ai_result["reason"]

    session.move_counter += 1
    session.board[row][col] = session.ai_symbol
    record = MoveRecord(
        move_number=session.move_counter,
        player="ai",
        row=row,
        col=col,
        reason=reason,
    )
    session.move_history.append(record)

    winner, cells = _check_winner(session.board)
    if winner == session.ai_symbol:
        session.status = "ai_wins"
        session.winner_cells = cells
        session.scores.losses += 1
        session.current_turn = "user"
    elif _is_draw(session.board):
        session.status = "draw"
        session.scores.draws += 1
        session.current_turn = "user"
    else:
        session.current_turn = "user"

    return record


def restart_game(user_id: uuid.UUID, keep_scores: bool = True) -> _GameSession:
    """Reset board state, optionally preserving scores."""
    key = str(user_id)
    session = _sessions.get(key)
    if session is None:
        session = _GameSession(user_id=user_id)
        _sessions[key] = session
        return session

    saved_scores = session.scores if keep_scores else Scores()
    # Re-use the same symbol the user had
    user_symbol = session.user_symbol
    session.board = _empty_board()
    session.status = "in_progress"
    session.winner_cells = []
    session.move_history = []
    session.move_counter = 0
    session.scores = saved_scores
    session.user_symbol = user_symbol
    session.ai_symbol = "O" if user_symbol == "X" else "X"
    session.current_turn = "ai" if user_symbol == "O" else "user"
    return session


def get_session(user_id: uuid.UUID) -> _GameSession:
    return _get_or_create(user_id)
