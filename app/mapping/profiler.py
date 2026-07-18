"""Schema profiling: look at a batch of raw records from one source and
describe each field by name and a handful of representative sample values,
so the mapper has something concrete to reason about."""

from typing import Any


def profile_fields(records: list[dict[str, Any]], samples_per_field: int = 5) -> dict[str, list[str]]:
    """Returns {field_name: [sample values...]} across the batch, skipping
    internal bookkeeping fields (prefixed with '_') and empty values."""
    profiles: dict[str, list[str]] = {}

    for record in records:
        for field_name, value in record.items():
            if field_name.startswith("_") or value in (None, ""):
                continue
            samples = profiles.setdefault(field_name, [])
            if len(samples) < samples_per_field:
                samples.append(str(value))

    return profiles
