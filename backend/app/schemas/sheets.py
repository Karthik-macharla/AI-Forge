"""Pydantic schemas for the Sheets / CSV Query Agent (Project 9)."""
from typing import Any

from pydantic import BaseModel, Field


class SheetQueryRequest(BaseModel):
    """Request body for querying a Google Sheet by URL."""
    sheet_url: str = Field(..., description="Full Google Sheets URL")
    question: str = Field(..., min_length=3, max_length=2000)


class ColumnSummary(BaseModel):
    name: str
    dtype: str


class DataFrameSummary(BaseModel):
    row_count: int
    col_count: int
    columns: list[ColumnSummary]
    preview: list[dict[str, Any]]


class SheetSummaryResponse(BaseModel):
    """Returned by POST /api/sheets/summary-url after loading a sheet."""
    source: str        # "google_sheet" | "csv" | "xlsx"
    sheet_url: str     # echoed back (empty string for file uploads)
    summary: DataFrameSummary
