"""Parser for Instagram lead-ads CSV exports. These arrive as a flat CSV
with a small, fairly stable set of columns."""

from __future__ import annotations

from io import StringIO
from typing import Any

import pandas as pd


def parse_instagram_csv(csv_text: str | bytes) -> list[dict[str, Any]]:
    buf = StringIO(csv_text.decode() if isinstance(csv_text, bytes) else csv_text)
    df = pd.read_csv(buf, dtype=str)
    df = df.where(pd.notna(df), None)
    return df.to_dict(orient="records")
