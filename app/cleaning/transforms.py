"""Field-level cleaning transforms. Each function takes one messy raw value
and returns a normalized value, or None if it can't make sense of it (bad
data is not an error -- it's just left for the validation layer to reject).

This module is intentionally kept small and self-contained: it is the piece
the self-healing agent (app/agent) is allowed to rewrite on disk when a
transform raises an unexpected exception, so keep each function narrowly
scoped to one field.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import phonenumbers
from dateutil import parser as dateutil_parser
from email_validator import EmailNotValidError, validate_email

CONSENT_TRUE = {"true", "yes", "y", "1", "on", "opted_in", "opt_in", "checked", "agree", "agreed"}
CONSENT_FALSE = {"false", "no", "n", "0", "off", "opted_out", "opt_out", "unchecked", "disagree"}


def normalize_phone(value: Any, default_region: str = "US") -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = phonenumbers.parse(text, default_region)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(parsed):
        return None
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def normalize_email(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        result = validate_email(text, check_deliverability=False)
    except EmailNotValidError:
        return None
    return result.normalized.lower()


def parse_datetime_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = dateutil_parser.parse(text)
    except (ValueError, OverflowError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_consent(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in CONSENT_TRUE:
        return True
    if text in CONSENT_FALSE:
        return False
    return None


def split_full_name(value: Any) -> tuple[str | None, str | None]:
    if value is None:
        return None, None
    parts = str(value).strip().split()
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], " ".join(parts[1:])
