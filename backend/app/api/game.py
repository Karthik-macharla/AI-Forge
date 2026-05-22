"""
Tic Tac Toe API router — Project 11.

Routes (prefix /api/game):
  POST /api/game/start    — start a new game, user chooses symbol
  POST /api/game/move     — user submits move → AI responds
  POST /api/game/restart  — reset board, optionally keep scores
  GET  /api/game/history  — move history with AI reasons
  GET  /api/game/scores   — current session scores

All routes require JWT auth (same cookie-based dependency as nl2sql.py).
All business logic is delegated to game_service.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.logging import logger
from app.schemas.game import (
    GameHistoryResponse,
    GameRestartRequest,
    GameRestartResponse,
    GameStartRequest,
    GameStartResponse,
    MoveRecord,
    MoveRequest,
    MoveResponse,
    Scores,
    ScoresResponse,
)
from app.services import game_service

router = APIRouter(prefix="/api/game", tags=["game"])


def _status_message(status: str, current_turn: str) -> str:
    messages = {
        "user_wins": "🎉 You win!",
        "ai_wins": "🤖 AI wins!",
        "draw": "🤝 It's a draw!",
        "in_progress": "Your turn!" if current_turn == "user" else "AI is thinking…",
    }
    return messages.get(status, "")


# ── POST /api/game/start ───────────────────────────────────────────────────

@router.post("/start", response_model=GameStartResponse)
async def start_game(
    body: GameStartRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> GameStartResponse:
    """Start a new game. If user picks 'O', the AI (X) moves first automatically."""
    session = game_service.start_game(current_user.id, body.user_symbol)

    ai_move_record: MoveRecord | None = None

    # If AI goes first (user chose O), make the opening AI move
    if session.current_turn == "ai":
        try:
            ai_move_record = await game_service.apply_ai_move(session)
        except Exception as exc:
            logger.error("AI opening move failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"error": "ai_error", "message": "AI failed to make its opening move."},
            )

    return GameStartResponse(
        board=session.board,
        status=session.status,
        user_symbol=session.user_symbol,
        ai_symbol=session.ai_symbol,
        current_turn=session.current_turn,
        scores=session.scores,
        ai_move=ai_move_record,
        message=_status_message(session.status, session.current_turn),
    )


# ── POST /api/game/move ────────────────────────────────────────────────────

@router.post("/move", response_model=MoveResponse)
async def make_move(
    body: MoveRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> MoveResponse:
    """
    User submits a move. If the game continues, the AI responds immediately.
    Returns the updated board, both moves, and game status.
    """
    session = game_service.get_session(current_user.id)

    # Validate user move
    error = game_service.validate_user_move(session, body.row, body.col)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_move", "message": error},
        )

    # Apply user move
    user_record = game_service.apply_user_move(session, body.row, body.col)

    # AI responds unless game is already over
    ai_record: MoveRecord | None = None
    if session.status == "in_progress":
        try:
            ai_record = await game_service.apply_ai_move(session)
        except Exception as exc:
            logger.error("AI move failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"error": "ai_error", "message": "AI failed to respond. Please try again."},
            )

    return MoveResponse(
        board=session.board,
        status=session.status,
        current_turn=session.current_turn,
        user_move=user_record,
        ai_move=ai_record,
        winner_cells=session.winner_cells,
        scores=session.scores,
        message=_status_message(session.status, session.current_turn),
    )


# ── POST /api/game/restart ─────────────────────────────────────────────────

@router.post("/restart", response_model=GameRestartResponse)
async def restart_game(
    body: GameRestartRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> GameRestartResponse:
    """Reset the board. Scores are kept by default."""
    session = game_service.restart_game(current_user.id, body.keep_scores)

    # If AI goes first on restart (user had O), make opening move
    if session.current_turn == "ai" and session.status == "in_progress":
        try:
            await game_service.apply_ai_move(session)
        except Exception as exc:
            logger.error("AI opening move on restart failed: %s", exc)

    return GameRestartResponse(
        board=session.board,
        status=session.status,
        current_turn=session.current_turn,
        scores=session.scores,
        message=_status_message(session.status, session.current_turn),
    )


# ── GET /api/game/history ──────────────────────────────────────────────────

@router.get("/history", response_model=GameHistoryResponse)
async def get_history(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> GameHistoryResponse:
    """Return full move history for the current game."""
    session = game_service.get_session(current_user.id)
    return GameHistoryResponse(
        moves=session.move_history,
        status=session.status,
        scores=session.scores,
    )


# ── GET /api/game/scores ───────────────────────────────────────────────────

@router.get("/scores", response_model=ScoresResponse)
async def get_scores(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ScoresResponse:
    """Return the current session's cumulative win/loss/draw counts."""
    session = game_service.get_session(current_user.id)
    return ScoresResponse(scores=session.scores)
