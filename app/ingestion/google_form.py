"""Parser for Google Forms CSV export (Responses sheet downloaded as CSV).
Column names are whatever the form author typed as question text, so they
vary form to form -- the mapping layer is what makes sense of them, this
loader just gets the CSV into a flat list of dicts."""

from __future__ import annotations

from io import StringIO
from typing import Any

import pandas as pd


def parse_google_form_csv(csv_text: str | bytes) -> list[dict[str, Any]]:
    buf = StringIO(csv_text.decode() if isinstance(csv_text, bytes) else csv_text)
    df = pd.read_csv(buf, dtype=str)
    df = df.where(pd.notna(df), None)
    return df.to_dict(orient="records")
