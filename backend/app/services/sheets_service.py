"""
Sheets service — Project 9.

Loads data into a Pandas DataFrame from either:
  - A Google Sheet URL (authenticated via service account)
  - An uploaded .csv or .xlsx file (bytes in memory)

All blocking I/O must be called inside asyncio.to_thread() at the call site.
"""
import io
import json
from typing import Any

import gspread
import pandas as pd

from app.core.config import settings
from app.core.logging import logger


def _get_gspread_client() -> gspread.Client:
    """Return an authenticated gspread client using the service account JSON string."""
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise ValueError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not set. "
            "Set it to the full JSON string of your service account key."
        )
    creds_dict: dict[str, Any] = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    # gspread >= 6.x — service_account_from_dict() replaces gspread.authorize()
    return gspread.service_account_from_dict(creds_dict)


def load_sheet_as_dataframe(sheet_url: str) -> pd.DataFrame:
    """Open a Google Sheet by URL and return ALL worksheets combined into one DataFrame.

    Each row gets a '_Sheet' column with the worksheet title so the agent can
    filter by tab if needed. Sheets with identical columns merge cleanly; sheets
    with different columns are union-merged (missing columns filled with NaN).

    Sync — call inside asyncio.to_thread().
    Raises ValueError if credentials are missing or the sheet is inaccessible.
    """
    client = _get_gspread_client()
    try:
        spreadsheet = client.open_by_url(sheet_url)
    except gspread.exceptions.APIError as exc:
        logger.error("Google Sheets API error for %s: %s", sheet_url, exc)
        raise ValueError(f"Cannot open sheet: {exc}") from exc

    worksheets = spreadsheet.worksheets()
    if not worksheets:
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    for ws in worksheets:
        records = ws.get_all_records()
        if not records:
            continue
        df_ws = pd.DataFrame(records)
        df_ws.insert(0, "_Sheet", ws.title)   # tag source tab
        frames.append(df_ws)
        logger.info("Loaded sheet tab '%s': %d rows × %d cols", ws.title, len(df_ws), len(df_ws.columns))

    if not frames:
        return pd.DataFrame()

    if len(frames) == 1:
        # Single tab — drop the _Sheet column for a cleaner experience
        df = frames[0].drop(columns=["_Sheet"])
    else:
        df = pd.concat(frames, ignore_index=True, sort=False)
        logger.info("Combined %d sheet tabs → %d rows × %d cols", len(frames), len(df), len(df.columns))

    return df


def load_csv_as_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    """Parse uploaded .csv or .xlsx bytes into a DataFrame.

    Sync — call inside asyncio.to_thread().
    """
    if filename.lower().endswith(".xlsx"):
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    else:
        # Try UTF-8, fall back to latin-1 for Windows-exported CSVs
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
    logger.info("Loaded file %s: %d rows × %d cols", filename, len(df), len(df.columns))
    return df


def get_df_summary(df: pd.DataFrame) -> dict:
    """Return a lightweight summary of the DataFrame for the schema panel."""
    return {
        "row_count": len(df),
        "col_count": len(df.columns),
        "columns": [
            {"name": col, "dtype": str(df[col].dtype)}
            for col in df.columns
        ],
        "preview": df.head(5).to_dict(orient="records"),
    }
