"""
NL2SQL router.

POST /api/nl2sql/query   — stream NL→SQL→execute→answer pipeline
GET  /api/nl2sql/schema  — return cached schema summary (tables + columns)
GET  /api/nl2sql/history — return the authenticated user's query history

No business logic here — all work is delegated to nl2sql_service.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.auth import CurrentUser, get_current_user
from app.schemas.nl2sql import NL2SQLQueryRequest, SchemaResponse, TableInfo, ColumnInfo, HistoryResponse, HistoryEntry
from app.services import nl2sql_service
from app.db.supabase_client import get_supabase
from app.core.logging import logger

router = APIRouter(prefix="/api/nl2sql", tags=["NL2SQL"])


@router.post("/query", response_class=StreamingResponse)
async def query_nl2sql(
    request: NL2SQLQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """Convert a natural-language question to SQL, execute it, and stream the answer."""
    return StreamingResponse(
        nl2sql_service.stream_nl2sql_response(
            question=request.question,
            user_id=current_user.id,
            user_email=current_user.email,
            db_key=request.db_key,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/schema", response_model=SchemaResponse)
async def get_schema(
    db_key: str = "main",
    current_user: CurrentUser = Depends(get_current_user),
) -> SchemaResponse:
    """Return the cached schema summary for the target database."""
    info = await nl2sql_service.get_schema_info(db_key=db_key)
    return SchemaResponse(
        dialect=info["dialect"],
        db_key=info["db_key"],
        tables=[
            TableInfo(
                name=t["name"],
                row_count=t["row_count"],
                columns=[ColumnInfo(name=c["name"], type=c["type"]) for c in t["columns"]],
            )
            for t in info["tables"]
        ],
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = 20,
    current_user: CurrentUser = Depends(get_current_user),
) -> HistoryResponse:
    """Return the authenticated user's NL2SQL query history (most recent first)."""
    try:
        sb = get_supabase()
        res = (
            sb.table("nl2sql_history")
            .select("*")
            .eq("user_id", str(current_user.id))
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        entries = [
            HistoryEntry(
                id=row["id"],
                question=row["question"],
                generated_sql=row["generated_sql"],
                answer=row["answer"],
                db_key=row.get("db_key", "main"),
                row_count=row.get("row_count", 0),
                created_at=row["created_at"],
            )
            for row in res.data
        ]
        return HistoryResponse(history=entries, total=len(entries))
    except Exception as exc:
        logger.warning("NL2SQL history fetch failed: %s", exc)
        return HistoryResponse(history=[], total=0)
