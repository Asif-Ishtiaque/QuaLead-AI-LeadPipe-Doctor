"""Parser for Facebook Lead Ads webhook payloads.

Facebook's webhook nests every submitted field inside a `field_data` list of
`{"name": ..., "values": [...]}` pairs, several levels deep inside
`entry -> changes -> value`. This flattens each leadgen event into one flat
dict so the rest of the pipeline never has to know about Facebook's shape.
"""

from typing import Any


def parse_facebook_webhook(payload: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "leadgen":
                continue
            value = change.get("value", {})

            flat: dict[str, Any] = {
                "leadgen_id": value.get("leadgen_id"),
                "form_id": value.get("form_id"),
                "page_id": value.get("page_id"),
                "created_time": value.get("created_time"),
            }
            for field in value.get("field_data", []):
                name = field.get("name")
                values = field.get("values") or [None]
                flat[name] = values[0]

            records.append(flat)

    return records
