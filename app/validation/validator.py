"""Runs cleaned records through the canonical Pydantic model. Rows that
don't fit are rejected with their validation error captured, rather than
raising -- a row of bad data is an expected outcome, not a pipeline bug."""

from typing import Any

from pydantic import ValidationError

from app.schema.canonical import Lead


class ValidationResult:
    def __init__(self, valid: list[Lead], invalid: list[dict[str, Any]]):
        self.valid = valid
        self.invalid = invalid

    @property
    def valid_rate(self) -> float:
        total = len(self.valid) + len(self.invalid)
        return len(self.valid) / total if total else 0.0


def validate_records(records: list[dict[str, Any]], source: str) -> ValidationResult:
    valid: list[Lead] = []
    invalid: list[dict[str, Any]] = []

    for record in records:
        payload = {**record, "source": source}
        try:
            lead = Lead(**payload)
        except ValidationError as exc:
            invalid.append({
                "record": record,
                "errors": exc.errors(include_url=False, include_context=False),
            })
            continue
        valid.append(lead)

    return ValidationResult(valid=valid, invalid=invalid)
