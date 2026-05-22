"""
Sheets router — Project 9.

POST /api/sheets/query-url    — stream answer for a Google Sheet URL + question
POST /api/sheets/query-file   — stream answer for an uploaded .csv / .xlsx + question
POST /api/sheets/summary-url  — return DataFrame summary for a Google Sheet URL

No business logic here — all work delegated to sheets_service and sheets_chain.
"""
import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.ai.chains.sheets_chain import stream_dataframe_answer
from app.core.auth import CurrentUser, get_current_user
from app.schemas.sheets import (
    ColumnSummary,
    DataFrameSummary,
    SheetQueryRequest,
    SheetSummaryResponse,
)
from app.services import sheets_service

router = APIRouter(prefix="/api/sheets", tags=["Sheets"])

_MAX_FILE_MB = 20
_ALLOWED_EXTENSIONS = (".csv", ".xlsx")


def _make_stream(df, question: str, user_email: str):
    """Wrap the async generator for StreamingResponse — appends [DONE]."""
    async def _generator():
        try:
            async for token in stream_dataframe_answer(df, question, user_email):
                yield token
        except Exception as exc:  # noqa: BLE001
            yield f"[ERROR]{exc}[/ERROR]"
        yield "[DONE]"
    return _generator()


@router.post("/query-url", response_class=StreamingResponse)
async def query_sheet_url(
    request: SheetQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """Load a Google Sheet by URL and stream a natural-language answer."""
    try:
        df = await asyncio.to_thread(
            sheets_service.load_sheet_as_dataframe, request.sheet_url
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "sheet_load_error", "message": str(exc)},
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_sheet", "message": "The sheet has no data."},
        )

    return StreamingResponse(
        _make_stream(df, request.question, current_user.email),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/query-file", response_class=StreamingResponse)
async def query_uploaded_file(
    question: str = Form(..., min_length=3, max_length=2000),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """Accept a .csv or .xlsx upload and stream a natural-language answer."""
    filename = file.filename or ""
    if not any(filename.lower().endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=415,
            detail={
                "error": "unsupported_file",
                "message": "Only .csv and .xlsx files are accepted.",
            },
        )

    content = await file.read()
    if len(content) > _MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "file_too_large",
                "message": f"File exceeds the {_MAX_FILE_MB} MB limit.",
            },
        )

    try:
        df = await asyncio.to_thread(
            sheets_service.load_csv_as_dataframe, content, filename
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "file_parse_error", "message": str(exc)},
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_file", "message": "The uploaded file has no data."},
        )

    return StreamingResponse(
        _make_stream(df, question, current_user.email),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/summary-url", response_model=SheetSummaryResponse)
async def get_sheet_summary(
    request: SheetQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> SheetSummaryResponse:
    """Load a Google Sheet by URL and return its structure (columns + preview rows)."""
    try:
        df = await asyncio.to_thread(
            sheets_service.load_sheet_as_dataframe, request.sheet_url
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "sheet_load_error", "message": str(exc)},
        ) from exc

    info = sheets_service.get_df_summary(df)
    return SheetSummaryResponse(
        source="google_sheet",
        sheet_url=request.sheet_url,
        summary=DataFrameSummary(
            row_count=info["row_count"],
            col_count=info["col_count"],
            columns=[
                ColumnSummary(name=c["name"], dtype=c["dtype"])
                for c in info["columns"]
            ],
            preview=info["preview"],
        ),
    )
