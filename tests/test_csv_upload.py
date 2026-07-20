"""Tests for the generic 'upload any CSV' ingestion path -- an arbitrary
CSV with unknown column names, parsed straight to flat dicts for the field
mapper. Covers the parser and the ingest() dispatch wiring; the actual
column->canonical mapping is the mapper's job (and needs Ollama), so it's
not exercised here."""

from app.ingestion import ingest
from app.ingestion.csv_upload import parse_csv_upload
from app.schema.canonical import LeadSource


def test_parses_arbitrary_headers_into_row_dicts():
    csv = "Full Name,Work Email,Cell\nAda Lovelace,ada@corp.com,415-555-0100\n"
    rows = parse_csv_upload(csv)
    assert rows == [{"Full Name": "Ada Lovelace", "Work Email": "ada@corp.com", "Cell": "415-555-0100"}]


def test_missing_cells_become_none_not_nan():
    csv = "name,email,phone\nGrace,,555-0100\n"
    rows = parse_csv_upload(csv)
    assert rows[0]["email"] is None


def test_numeric_looking_values_stay_strings():
    # A phone that looks numeric must not be coerced to a float (4155550100.0).
    csv = "name,phone\nAda,4155550100\n"
    assert parse_csv_upload(csv)[0]["phone"] == "4155550100"


def test_empty_input_returns_empty_list():
    assert parse_csv_upload("") == []
    assert parse_csv_upload("   \n  ") == []


def test_ingest_dispatch_tags_rows_with_the_csv_upload_source():
    csv = "name,email\nAda,ada@corp.com\n"
    rows = ingest(LeadSource.CSV_UPLOAD, csv)
    assert rows[0]["_source"] == "csv_upload"
    assert rows[0]["name"] == "Ada"
