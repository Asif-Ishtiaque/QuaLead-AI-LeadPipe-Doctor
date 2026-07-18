"""Parser for a custom landing-page form submission, posted as JSON -- either
a single object or a batch/array of objects."""

from __future__ import annotations

from typing import Any


def parse_landing_page_json(payload: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        payload = [payload]
    return list(payload)
