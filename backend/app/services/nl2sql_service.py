"""
NL2SQL service.

Responsibilities:
  1. Schema introspection — reads table/column/type metadata from the target DB;
     caches the result with a configurable TTL (NL2SQL_SCHEMA_CACHE_TTL seconds).
  2. SQL execution  — runs a validated SELECT against the target DB in a thread pool;
     hard-blocks any non-SELECT statement.
  3. Orchestration  — ties together schema introspection, SQL generation chain,
     SQL execution, answer-streaming chain, and history persistence.

All DB I/O (sync SQLAlchemy) runs inside asyncio.to_thread() so the async event
loop is never blocked.
"""
import asyncio
import json
import time
import uuid
from typing import Any, AsyncIterator

from fastapi import HTTPException

from app.ai.chains.nl2sql_chain import generate_sql, stream_answer
from app.core.config import settings
from app.core.logging import logger
from app.db.supabase_client import get_supabase


# ── Schema cache ───────────────────────────────────────────────────────────

_schema_cache: dict[str, tuple[str, float]] = {}  # db_key → (schema_str, expiry_ts)


def _introspect_schema_via_supabase() -> str:
    """Call nl2sql_schema_info() Supabase RPC and return a human-readable schema string."""
    sb = get_supabase()
    try:
        result = sb.rpc("nl2sql_schema_info", {}).execute()
    except Exception as exc:
        raise RuntimeError(f"Schema introspection RPC failed: {exc}") from exc

    rows = result.data or []

    # Group by table_name (rows are ordered: table_name, ordinal_position)
    tables: dict[str, dict] = {}
    for row in rows:
        tname = row["table_name"]
        if tname not in tables:
            tables[tname] = {
                "approx_count": row.get("approx_row_count", -1),
                "columns": [],
                "fks": [],
            }
        tables[tname]["columns"].append(row)
        if row.get("fk_table"):
            entry = (row["column_name"], row["fk_table"], row["fk_column"])
            if entry not in tables[tname]["fks"]:
                tables[tname]["fks"].append(entry)

    lines: list[str] = []
    for tname, info in sorted(tables.items()):
        raw_count = info["approx_count"]
        count = raw_count if (raw_count is not None and raw_count >= 0) else "?"
        lines.append(f"Table: {tname} ({count} rows)")
        for col in info["columns"]:
            nullable = " NOT NULL" if not col.get("is_nullable") else ""
            pk = " [PK]" if col.get("is_primary_key") else ""
            lines.append(f"  - {col['column_name']}: {col['data_type']}{nullable}{pk}")
        for fk_col, fk_table, fk_ref_col in info["fks"]:
            lines.append(f"  FK: {fk_col} → {fk_table}.{fk_ref_col}")
        lines.append("")
    return "\n".join(lines).strip()


def get_schema(db_key: str = "main") -> str:
    """Return cached schema string, refreshing when the TTL has expired."""
    now = time.time()
    cached = _schema_cache.get(db_key)
    if cached and now < cached[1]:
        return cached[0]

    schema_str = _introspect_schema_via_supabase()
    expiry = now + settings.NL2SQL_SCHEMA_CACHE_TTL
    _schema_cache[db_key] = (schema_str, expiry)
    logger.info("NL2SQL schema refreshed for db_key=%s", db_key)
    return schema_str


def invalidate_schema_cache(db_key: str = "main") -> None:
    """Force a schema refresh on the next request."""
    _schema_cache.pop(db_key, None)


# ── SQL execution ──────────────────────────────────────────────────────────

_BLOCKED_KEYWORDS = frozenset(
    {"INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "REPLACE", "MERGE"}
)

# Tables that are internal/operational and must never be exposed to the LLM
_EXCLUDED_TABLES: frozenset[str] = frozenset({
    "alembic_version",
})


def _is_safe_select(sql: str) -> bool:
    """Return True only if the statement is a plain SELECT with no DDL/DML keywords.

    Uses word-boundary regex so column names like 'create_date' or 'drop_count'
    do not cause false positives.
    """
    import re
    upper = sql.upper()
    if not upper.strip().startswith("SELECT"):
        return False
    for kw in _BLOCKED_KEYWORDS:
        # Match keyword only at word boundaries to avoid false positives
        # (e.g. 'create_date' column should not block a SELECT)
        if re.search(rf"\b{kw}\b", upper):
            return False
    return True


def _execute_sql_via_supabase(sql: str, max_rows: int) -> list[dict[str, Any]]:
    """Call nl2sql_execute() Supabase RPC and return rows as list[dict]."""
    sb = get_supabase()
    try:
        result = sb.rpc("nl2sql_execute", {"p_sql": sql}).execute()
    except Exception as exc:
        err_msg = str(exc)
        if "Only SELECT" in err_msg:
            raise ValueError("Unsafe query blocked by database") from exc
        raise RuntimeError(f"SQL execution RPC failed: {err_msg}") from exc

    rows = result.data
    if not isinstance(rows, list):
        rows = [rows] if rows else []
    return rows[:max_rows]


# ── History persistence (bonus) ─────────────────────────────────────────────

def _save_history(
    user_id: uuid.UUID,
    question: str,
    sql: str,
    answer: str,
    db_key: str,
    row_count: int,
) -> None:
    """Persist a NL2SQL query to the nl2sql_history table (best-effort)."""
    try:
        sb = get_supabase()
        sb.table("nl2sql_history").insert(
            {
                "id": str(uuid.uuid4()),
                "user_id": str(user_id),
                "question": question,
                "generated_sql": sql,
                "answer": answer,
                "db_key": db_key,
                "row_count": row_count,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        # History table may not exist yet — log and continue (never fail the request)
        logger.warning("NL2SQL history save failed (table may not exist): %s", exc)


# ── Orchestration ──────────────────────────────────────────────────────────

async def stream_nl2sql_response(
    question: str,
    user_id: uuid.UUID,
    user_email: str,
    db_key: str = "main",
) -> AsyncIterator[str]:
    """
    Full NL2SQL pipeline — yields raw string chunks for StreamingResponse.

    Stream protocol:
        [SQL]<generated_sql>[/SQL]   — emitted once, before answer tokens
        <token> ...                  — streamed answer tokens
        [DONE]                       — terminal marker
    """
    dialect = "PostgreSQL"  # Supabase is always PostgreSQL

    # 1. Schema introspection (may hit cache)
    schema = await asyncio.to_thread(get_schema, db_key)

    # 2. SQL generation (non-streaming LLM call)
    # NOTE: We must NOT raise HTTPException here — we are inside an async generator
    # and FastAPI has already committed 200 OK headers for the StreamingResponse.
    # Raising inside a generator silently closes the stream, leaving the client with
    # an empty body and no error information. Instead, emit [ERROR]...[/ERROR][DONE].
    try:
        sql = await generate_sql(
            question=question,
            schema=schema,
            dialect=dialect,
            user_email=user_email,
        )
    except ValueError as exc:
        yield f"[ERROR]{exc}[/ERROR]"
        yield "[DONE]"
        return
    except Exception as exc:
        yield f"[ERROR]SQL generation failed: {exc}[/ERROR]"
        yield "[DONE]"
        return

    # 3. Safety check (belt-and-suspenders beyond the prompt)
    if not _is_safe_select(sql):
        yield "[ERROR]Generated statement is not a safe SELECT query.[/ERROR]"
        yield "[DONE]"
        return

    # 4. Emit SQL block to the client before executing
    yield f"[SQL]{sql}[/SQL]"

    # 5. Execute SQL in a thread pool
    try:
        rows: list[dict[str, Any]] = await asyncio.to_thread(
            _execute_sql_via_supabase, sql, settings.NL2SQL_MAX_ROWS
        )
    except Exception as exc:
        logger.error("NL2SQL execution error: %s", exc)
        yield f"[ERROR]{exc}[/ERROR]"
        yield "[DONE]"
        return

    # 6. Stream natural-language answer
    rows_json = json.dumps(rows, default=str)
    answer_parts: list[str] = []
    async for token in stream_answer(
        question=question,
        rows_json=rows_json,
        user_email=user_email,
    ):
        answer_parts.append(token)
        yield token

    # 7. Emit rows as JSON before the terminal marker
    yield f"[ROWS]{json.dumps(rows, default=str)}[/ROWS]"

    # 8. Terminal marker
    yield "[DONE]"

    # 9. Persist history (best-effort, non-blocking)
    asyncio.create_task(
        asyncio.to_thread(
            _save_history,
            user_id,
            question,
            sql,
            "".join(answer_parts),
            db_key,
            len(rows),
        )
    )


async def get_schema_info(db_key: str = "main") -> dict[str, Any]:
    """Return structured schema info (tables + columns) for the frontend schema browser."""
    schema_str = await asyncio.to_thread(get_schema, db_key)

    # Parse the text schema back into structured JSON for the API response
    tables: list[dict[str, Any]] = []
    current_table: dict[str, Any] | None = None

    for line in schema_str.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("Table:"):
            # "Table: employees (50 rows)"
            parts = line[len("Table:"):].strip().split("(")
            table_name = parts[0].strip()
            row_count_str = parts[1].rstrip(" rows)").strip() if len(parts) > 1 else "?"
            try:
                row_count = int(row_count_str)
            except ValueError:
                row_count = 0
            current_table = {"name": table_name, "row_count": row_count, "columns": []}
            tables.append(current_table)
        elif line.startswith("- ") and current_table is not None:
            # "- id: INTEGER NOT NULL [PK]"
            col_def = line[2:]
            if ":" in col_def:
                col_name, col_rest = col_def.split(":", 1)
                current_table["columns"].append(
                    {"name": col_name.strip(), "type": col_rest.strip()}
                )

    return {
        "dialect": "PostgreSQL",
        "db_key": db_key,
        "tables": tables,
    }
