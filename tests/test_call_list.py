"""Tests for the rep call-list workflow and the source-performance scorecard
(storage layer, exercised against a throwaway DuckDB)."""

import json
from datetime import datetime, timezone

import pytest

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
        source=LeadSource.FACEBOOK,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        phone_e164="+14155550123",
        consent=True,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        quality_score=70.0,
        status=LeadStatus.CLEAN,
    )
    defaults.update(overrides)
    return Lead(**defaults)


def test_call_list_orders_by_score_and_excludes_worked(fresh_db):
    storage.save_leads([
        _lead(lead_id="a", email="a@x.com", phone_e164="+14155550001", quality_score=90.0),
        _lead(lead_id="b", email="b@x.com", phone_e164="+14155550002", quality_score=50.0),
        _lead(lead_id="c", email="c@x.com", phone_e164="+14155550003", quality_score=70.0),
    ])

    ranked = [r["lead_id"] for r in storage.call_list(limit=10)]
    assert ranked == ["a", "c", "b"]  # highest score first

    # Mark the top lead contacted -> it drops off the queue.
    assert storage.set_disposition("a", "contacted") is True
    assert "a" not in [r["lead_id"] for r in storage.call_list(limit=10)]


def test_high_priority_floats_to_top_regardless_of_score(fresh_db):
    storage.save_leads([
        _lead(lead_id="hi", email="a@x.com", phone_e164="+14155550001", quality_score=90.0),
        _lead(lead_id="lo", email="b@x.com", phone_e164="+14155550002", quality_score=40.0),
    ])
    assert storage.set_disposition("lo", "high_priority") is True

    ranked = [r["lead_id"] for r in storage.call_list(limit=10)]
    assert ranked[0] == "lo"  # high_priority beats the higher score
    # follow_up stays in the queue (unlike contacted/not_interested)
    assert storage.set_disposition("hi", "follow_up") is True
    assert set(r["lead_id"] for r in storage.call_list(limit=10)) == {"lo", "hi"}


def test_set_disposition_unknown_lead_returns_false(fresh_db):
    storage.save_leads([_lead(lead_id="a", email="a@x.com", phone_e164="+14155550001")])
    assert storage.set_disposition("does-not-exist", "contacted") is False


def test_source_performance_reports_volume_avg_and_junk_rate(fresh_db):
    storage.save_leads([
        _lead(source=LeadSource.FACEBOOK, email="f1@x.com", phone_e164="+14155550001", quality_score=80.0),
        _lead(source=LeadSource.FACEBOOK, email="f2@x.com", phone_e164="+14155550002", quality_score=60.0),
    ])
    storage.save_leads(
        [_lead(source=LeadSource.FACEBOOK, email="dup@x.com", phone_e164="+14155550003", quality_score=55.0)],
        table="duplicate_leads",
    )
    storage.save_invalid(
        [{"record": {"junk": "row"}, "errors": [{"msg": "bad"}]}], source=LeadSource.FACEBOOK.value
    )

    perf = {r["source"]: r for r in storage.source_performance()}
    fb = perf["facebook"]
    assert fb["leads"] == 2
    assert fb["avg_score"] == 70.0  # (80 + 60) / 2
    assert fb["invalid"] == 1
    assert fb["duplicates"] == 1
    # junk = invalid / (kept + invalid + duplicates) = 1 / (2 + 1 + 1) = 25%
    assert fb["junk_percentage"] == 25.0
