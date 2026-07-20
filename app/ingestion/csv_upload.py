"""Parser for the generic "upload any CSV" path.

Unlike the source-specific loaders, this makes no assumption about which
tool produced the file or what its columns are called -- it just gets an
arbitrary CSV into a flat list of dicts and lets the RAG/LLM field mapper
(app/mapping) figure out which columns are name/email/phone/etc. This is
the loader behind POST /ingest/csv and the dashboard's Upload tab.
"""

from __future__ import annotations

from io import StringIO
from typing import Any

import pandas as pd


def parse_csv_upload(csv_text: str | bytes) -> list[dict[str, Any]]:
    text = csv_text.decode() if isinstance(csv_text, bytes) else csv_text
    if not text or not text.strip():
        return []
    # dtype=str so nothing is coerced (a phone like 4155550100 stays text,
    # not a float); NaN -> None so downstream sees genuine missing values.
    df = pd.read_csv(StringIO(text), dtype=str)
    df = df.where(pd.notna(df), None)
    return df.to_dict(orient="records")
