"""Pydantic schemas for the NL2SQL feature."""
from typing import Any

from pydantic import BaseModel, Field


# ── Request ────────────────────────────────────────────────────────────────

class NL2SQLQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000, description="Natural-language question")
    db_key: str = Field(default="main", description="Target database key (for multi-DB support)")


# ── Response ───────────────────────────────────────────────────────────────

class ColumnInfo(BaseModel):
    name: str
    type: str


class TableInfo(BaseModel):
    name: str
    row_count: int
    columns: list[ColumnInfo]


class SchemaResponse(BaseModel):
    dialect: str
    db_key: str
    tables: list[TableInfo]


class HistoryEntry(BaseModel):
    id: str
    question: str
    generated_sql: str
    answer: str
    db_key: str
    row_count: int
    created_at: str


class HistoryResponse(BaseModel):
    history: list[HistoryEntry]
    total: int
