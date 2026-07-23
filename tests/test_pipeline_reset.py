"""Tests for pipeline-run tracking and the workspace reset (storage layer +
the file-backed human-review queue), against a throwaway DuckDB / tmp files."""

from datetime import datetime, timezone

import pytest

from app.agent import human_review
from app.schema.canonical import Lead, LeadSource, LeadStatus
from app.utils import storage
from app.utils.config import settings


@pytest.fixture()
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_url", f"duckdb:///{tmp_path}/t.duckdb")
    storage.get_engine.cache_clear()
    yield
    storage.get_engine.cache_clear()


def _lead(**overrides) -> Lead:
    defaults = dict(
        source=LeadSource.FACEBOOK, first_name="Ada", last_name="Lovelace",
        email="ada@example.com", phone_e164="+14155550123", consent=True,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc), quality_score=70.0, status=LeadStatus.CLEAN,
    )
    defaults.update(overrides)
    return Lead(**defaults)


def test_pipeline_run_lifecycle(fresh_db):
    run_id = storage.create_pipeline_run("csv_upload")
    assert run_id

    mid = storage.get_pipeline_run(run_id)
    assert mid is not None
    assert mid["status"] == "processing"
    assert mid["finished_at"] is None

    storage.finish_pipeline_run(run_id, status="completed", total=10, processed=7, failed=2, duplicates=1)
    done = storage.get_pipeline_run(run_id)
    assert done["status"] == "completed"
    assert (done["total_records"], done["processed"], done["failed"], done["duplicates"]) == (10, 7, 2, 1)
    assert done["finished_at"] is not None
    assert done["time_taken_ms"] is not None and done["time_taken_ms"] >= 0


def test_get_unknown_run_returns_none(fresh_db):
    assert storage.get_pipeline_run("nope") is None


def test_recent_runs_newest_first(fresh_db):
    ids = [storage.create_pipeline_run(f"src{i}") for i in range(3)]
    for rid in ids:
        storage.finish_pipeline_run(rid, status="completed")
    recent = storage.recent_pipeline_runs(limit=10)
    assert len(recent) == 3
    assert recent[0]["started_at"] >= recent[-1]["started_at"]


def test_clear_lead_tables_empties_data(fresh_db):
    storage.save_leads([_lead(email="a@x.com", phone_e164="+14155550001")])
    storage.create_pipeline_run("csv_upload")
    assert not storage.read_recent("leads", 10).empty

    result = storage.clear_lead_tables()
    assert result["leads"] == "cleared"
    assert storage.read_recent("leads", 10).empty
    assert storage.recent_pipeline_runs(10) == []


def test_human_review_clear(tmp_path, monkeypatch):
    monkeypatch.setattr(human_review, "QUEUE_PATH", tmp_path / "queue.jsonl")
    human_review.enqueue("csv_upload", {"raw": 1}, "reason", "err", 3)
    human_review.enqueue("csv_upload", {"raw": 2}, "reason", "err", 3)
    assert len(human_review.read_all()) == 2

    removed = human_review.clear()
    assert removed == 2
    assert human_review.read_all() == []
