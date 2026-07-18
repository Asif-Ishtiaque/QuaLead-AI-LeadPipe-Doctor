"""Persistence for pipeline output. Backed by Postgres in docker-compose
(DATABASE_URL points at the `db` service) or a local DuckDB file when run
bare-metal for development -- both go through the same SQLAlchemy engine,
so nothing else in the app needs to know which one is active."""

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

from app.schema.canonical import Lead
from app.utils.config import settings


@lru_cache(maxsize=1)
def get_engine():
    if settings.database_url.startswith("duckdb"):
        db_path = settings.database_url.replace("duckdb:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(settings.database_url)


def _lead_to_row(lead: Lead) -> dict:
    row = lead.model_dump(mode="json")
    row["raw_payload"] = json.dumps(row["raw_payload"], default=str)
    return row


def save_leads(leads: list[Lead], table: str = "leads") -> None:
    if not leads:
        return
    df = pd.DataFrame([_lead_to_row(lead) for lead in leads])
    df.to_sql(table, get_engine(), if_exists="append", index=False)


def save_invalid(invalid: list[dict], source: str, table: str = "invalid_leads") -> None:
    if not invalid:
        return
    df = pd.DataFrame(
        [
            {
                "source": source,
                "record": json.dumps(item["record"], default=str),
                "errors": json.dumps(item["errors"], default=str),
            }
            for item in invalid
        ]
    )
    df.to_sql(table, get_engine(), if_exists="append", index=False)


def save_healing_events(source: str, events: list[dict], table: str = "healing_events") -> None:
    if not events:
        return
    df = pd.DataFrame([{**event, "source": source} for event in events])
    df.to_sql(table, get_engine(), if_exists="append", index=False)


def read_table(table: str) -> pd.DataFrame:
    try:
        return pd.read_sql_table(table, get_engine())
    except Exception:
        return pd.DataFrame()
