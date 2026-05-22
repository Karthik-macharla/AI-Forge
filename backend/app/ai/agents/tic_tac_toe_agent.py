"""
Tic Tac Toe AI Agent — Project 11.

Uses the same LiteLLM singleton (app/ai/llm.py) as all other chains.
The system prompt is loaded from app/ai/prompts/tictactoe_system.txt.

Responsibilities:
  - Accept board state and return a validated (row, col, reason) move
  - Retry up to TICTACTOE_MAX_RETRIES on invalid JSON or occupied cell
  - Fall back to first available valid cell if all retries fail
"""
import json
import pathlib
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.llm import llm
from app.core.config import settings
from app.core.logging import logger

Board = list[list[str]]  # 3x3 list of "", "X", or "O"

_SYSTEM_PROMPT = (
    pathlib.Path(__file__).parent.parent / "prompts" / "tictactoe_system.txt"
).read_text(encoding="utf-8")


# ── Helpers ────────────────────────────────────────────────────────────────

def _board_to_text(board: Board) -> str:
    """Format board as human-readable grid for the LLM prompt."""
    rows = []
    for i, row in enumerate(board):
        cells = " | ".join(cell if cell else " " for cell in row)
        rows.append(f"Row {i}: [{cells}]")
    return "\n".join(rows)


def _is_valid_move(board: Board, row: int, col: int) -> bool:
    """Return True if (row, col) is in-bounds and currently empty."""
    return 0 <= row <= 2 and 0 <= col <= 2 and board[row][col] == ""


def _fallback_move(board: Board) -> Optional[tuple[int, int]]:
    """Return first valid empty cell using strategic preference order."""
    priority = [(1, 1), (0, 0), (0, 2), (2, 0), (2, 2), (0, 1), (1, 0), (1, 2), (2, 1)]
    for r, c in priority:
        if board[r][c] == "":
            return r, c
    return None


# ── Agent ──────────────────────────────────────────────────────────────────

async def get_ai_move(board: Board) -> dict:
    """
    Ask the LLM for the best move on the given board.

    Returns:
        {"row": int, "col": int, "reason": str}

    Falls back to the first valid cell (strategic order) if the LLM fails
    after TICTACTOE_MAX_RETRIES attempts.
    """
    board_text = _board_to_text(board)
    board_json = json.dumps(board)
    human_content = (
        f"Current board (JSON): {board_json}\n\n"
        f"Formatted view:\n{board_text}\n\n"
        "Choose your move. Respond with valid JSON only."
    )

    last_error: str = ""
    for attempt in range(1, settings.TICTACTOE_MAX_RETRIES + 1):
        try:
            response = await llm.ainvoke(
                [
                    SystemMessage(content=_SYSTEM_PROMPT),
                    HumanMessage(content=human_content),
                ]
            )
            raw: str = response.content.strip()

            # Strip markdown fences if model adds them
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            data = json.loads(raw)
            row = int(data["row"])
            col = int(data["col"])
            reason: str = str(data.get("reason", "Strategic move"))

            if not _is_valid_move(board, row, col):
                last_error = f"LLM chose occupied/invalid cell ({row},{col})"
                logger.warning("TicTacToe agent attempt %d: %s", attempt, last_error)
                # Nudge the model on retry
                human_content += f"\n\nPrevious attempt invalid: cell ({row},{col}) is not empty. Choose a different cell."
                continue

            logger.info("TicTacToe agent move: row=%d col=%d reason=%r", row, col, reason)
            return {"row": row, "col": col, "reason": reason}

        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
            last_error = f"Invalid response format: {exc}"
            logger.warning("TicTacToe agent attempt %d parse error: %s", attempt, exc)
        except Exception as exc:
            last_error = f"LLM call failed: {exc}"
            logger.error("TicTacToe agent attempt %d LLM error: %s", attempt, exc)

    # All retries exhausted — fall back to deterministic heuristic
    logger.warning("TicTacToe agent: all retries exhausted (%s). Using fallback.", last_error)
    fallback = _fallback_move(board)
    if fallback is None:
        raise RuntimeError("No valid moves available — board is full.")
    return {"row": fallback[0], "col": fallback[1], "reason": "Fallback: choosing first available cell."}
