"""FastAPI entrypoint for LeadPipe Doctor.

Each /ingest/* route accepts one source's raw input, runs it through the
self-healing agent graph (ingest -> map -> clean -> validate -> dedup ->
score, with automatic LLM-driven recovery if the cleaning engine throws),
persists the results, and returns a summary."""

from __future__ import annotations

from typing import Any

import os

from fastapi import FastAPI, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent import human_review
from app.agent.graph import run_self_healing
from app.schema.canonical import LeadSource
from app.utils.storage import (
    get_analytics,
    get_stats,
    persist_leads_atomic,
    ranked_leads,
    read_recent,
    save_healing_events,
    save_invalid,
    save_leads,
    search_leads,
    top_leads,
)

app = FastAPI(title="LeadPipe Doctor", description="Self-healing lead ingestion agent")

# The Streamlit dashboard calls this API server-side, so it never needed
# CORS. The React frontend runs in the browser on a different origin
# (Vite dev :5173, preview :4173, or the nginx container :8080), so those
# fetches are subject to CORS -- without this middleware the browser blocks
# every request. Origins are overridable via CORS_ALLOW_ORIGINS (comma-
# separated); the default covers local dev. No credentials are used, so a
# wildcard is acceptable if you'd rather not enumerate origins.
_cors = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://localhost:4173,http://localhost:8080")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()] or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _persist_and_summarize(source: LeadSource, final_state: dict) -> dict[str, Any]:
    result = final_state.get("result")
    summary = None
    if result is not None:
        # persist_leads_atomic is the actual source of truth for what got
        # kept vs. deduped -- it can reclassify a lead that in-batch dedup
        # upstream thought was "kept" into a duplicate, if a concurrent
        # request already claimed that email/phone first. The summary
        # reflects that real outcome, not the pre-persistence guess.
        actually_kept, redirected = persist_leads_atomic(result.scored_leads)
        all_duplicates = result.duplicates + redirected
        save_leads(all_duplicates, table="duplicate_leads")
        save_invalid(result.invalid, source=source.value)

        summary = {**result.summary, "scored": len(actually_kept), "duplicates": len(all_duplicates)}

    save_healing_events(source.value, final_state["healing_events"])

    return {
        "status": final_state["status"],
        "retries": final_state["retries"],
        "healing_events": final_state["healing_events"],
        "summary": summary,
    }


def _decode(raw: bytes | str) -> str:
    # Tolerant decode. Excel's default "CSV (Comma delimited)" export is
    # Windows-1252, and "CSV UTF-8" prepends a BOM -- strict UTF-8 would raise
    # UnicodeDecodeError on any accented name or smart quote and 500 the
    # request before the pipeline ever runs. utf-8-sig strips the BOM;
    # errors="replace" guarantees no byte sequence can crash the upload.
    return raw.decode("utf-8-sig", errors="replace") if isinstance(raw, (bytes, bytearray)) else raw


def _run_and_persist(source: LeadSource, raw_text: str) -> dict[str, Any]:
    return _persist_and_summarize(source, run_self_healing(source, raw_text))


async def _ingest(source: LeadSource, raw_text: str) -> JSONResponse:
    # The pipeline + persistence do blocking I/O (LLM field-mapping, embedding
    # lookups, Postgres writes) that can run for tens of seconds. Offloading to
    # a threadpool keeps the event loop free, so the dashboard's 8s live polls
    # don't freeze while an upload processes. Any unexpected failure returns a
    # friendly payload (HTTP 200, status="error") -- never a raw 500 on screen.
    try:
        return JSONResponse(await run_in_threadpool(_run_and_persist, source, raw_text))
    except Exception:
        return JSONResponse(
            {
                "status": "error",
                "retries": 0,
                "healing_events": [],
                "summary": None,
                "message": "We processed your file but hit a problem saving the results. Please try again.",
            }
        )


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(value, hi))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest/facebook")
async def ingest_facebook(request: Request) -> JSONResponse:
    # Raw body, not a Pydantic-parsed dict: accepts either one JSON document
    # or JSONL (one webhook payload per line) -- FastAPI's automatic body
    # parsing would reject JSONL as invalid JSON before our code ever saw it.
    return await _ingest(LeadSource.FACEBOOK, _decode(await request.body()))


@app.post("/ingest/landing-page")
async def ingest_landing_page(request: Request) -> JSONResponse:
    return await _ingest(LeadSource.LANDING_PAGE, _decode(await request.body()))


@app.post("/ingest/instagram")
async def ingest_instagram(file: UploadFile) -> JSONResponse:
    return await _ingest(LeadSource.INSTAGRAM, _decode(await file.read()))


@app.post("/ingest/google-form")
async def ingest_google_form(file: UploadFile) -> JSONResponse:
    return await _ingest(LeadSource.GOOGLE_FORM, _decode(await file.read()))


@app.post("/ingest/csv")
async def ingest_csv(file: UploadFile) -> JSONResponse:
    # Generic "upload any CSV" path: no assumption about column names or which
    # tool produced the file -- the RAG/LLM field mapper resolves the columns.
    return await _ingest(LeadSource.CSV_UPLOAD, _decode(await file.read()))


@app.get("/leads")
def list_leads(limit: int = 100) -> list[dict[str, Any]]:
    return read_recent("leads", _clamp(limit, 1, 1000)).to_dict(orient="records")


@app.get("/leads/top")
def list_top_leads(
    limit: int = 8,
    source: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
) -> list[dict[str, Any]]:
    # Highest-scoring leads for the "work these first" panels. Ordering + cap
    # live in SQL, so the response is `limit` rows, not the whole table.
    # Optional source / score-range filters back the Lead Analytics controls.
    return top_leads(limit=_clamp(limit, 1, 200), source=source, min_score=min_score, max_score=max_score)


@app.get("/leads/ranked")
def list_ranked_leads(
    limit: int = 10,
    offset: int = 0,
    source: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
) -> dict[str, Any]:
    # Paginated score-ranked call list: one page of rows + the true match
    # total, so the UI can page without downloading the whole table. limit is
    # capped and offset floored so a hand-crafted request can't ask for a
    # multi-megabyte page or a negative window.
    return ranked_leads(
        limit=_clamp(limit, 1, 500), offset=max(0, offset), source=source, min_score=min_score, max_score=max_score
    )


@app.get("/leads/search")
def search_leads_endpoint(q: str | None = None, source: str | None = None, limit: int = 200) -> dict[str, Any]:
    # Server-side search for the Leads table: returns the matching page of
    # rows plus the true match total ("showing N of M"), without the browser
    # ever downloading M rows.
    return search_leads(q=q, source=source, limit=_clamp(limit, 1, 500))


@app.get("/analytics")
def analytics() -> dict[str, Any]:
    # SQL-aggregated per-source metrics + score-bucket histogram that drive
    # every chart/KPI on the dashboard. Replaces the old client-side reduction
    # over a 32 MB /leads?limit=100000 download (see storage.get_analytics).
    return get_analytics()


@app.get("/duplicates")
def list_duplicates(limit: int = 1000) -> list[dict[str, Any]]:
    return read_recent("duplicate_leads", limit).to_dict(orient="records")


@app.get("/invalid")
def list_invalid(limit: int = 1000) -> list[dict[str, Any]]:
    return read_recent("invalid_leads", limit).to_dict(orient="records")


@app.get("/healing-events")
def list_healing_events(limit: int = 1000) -> list[dict[str, Any]]:
    return read_recent("healing_events", limit).to_dict(orient="records")


@app.get("/stats")
def stats() -> dict[str, Any]:
    # SQL-aggregated (COUNT/AVG/GROUP BY) rather than loading entire
    # tables into pandas -- see app/utils/storage.py:get_stats for why.
    return {**get_stats(), "human_review_pending": len(human_review.read_all())}


@app.get("/human-review")
def list_human_review() -> list[dict[str, Any]]:
    return human_review.read_all()
