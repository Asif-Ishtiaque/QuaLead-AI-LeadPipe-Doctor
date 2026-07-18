# LeadPipe Doctor -- Self-Healing Lead Ingestion Agent

Messy leads go in (Facebook webhook JSON, Instagram CSV, Google Form CSV,
landing-page JSON) and clean, validated, deduplicated, scored leads come
out -- in one canonical schema, regardless of source. When the cleaning
code itself breaks on a batch it's never seen before, the agent reads the
traceback, asks a local LLM to patch the broken function, and retries
automatically before ever bothering a human.

100% free and open source. No paid APIs, no cloud LLM calls -- everything
(LLM, embeddings, vector store, database, ML) runs locally.

## The problem

Every lead source names its fields differently, formats phone numbers
differently, and breaks your ingestion code in a new way eventually. Most
pipelines handle this by having an engineer notice the crash, read the
traceback, patch the code, redeploy. LeadPipe Doctor closes that loop
inside the pipeline itself: a LangGraph agent catches the exception,
hands the traceback and the offending source file to a local LLM
(Ollama), validates and applies the LLM's patch, and re-runs the batch --
up to 3 times -- before giving up and routing the batch to a human review
queue.

## Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Ingestion                       │
   Facebook JSON ──►│  app/ingestion/{facebook,instagram,             │
   Instagram CSV ──►│  google_form,landing_page}.py                    │
   Google Form CSV─►│  -> flat list[dict], one shape per source        │
   Landing page ───►│                                                   │
                    └───────────────────────┬───────────────────────────┘
                                             ▼
                    ┌─────────────────────────────────────────────────┐
                    │         Schema profiling + RAG mapping           │
                    │  app/mapping/profiler.py, mapper.py, rag_store.py│
                    │  ChromaDB stores canonical field descriptions +  │
                    │  past (source, field) -> canonical decisions.    │
                    │  Ollama (qwen2.5) proposes new mappings, grounded │
                    │  in the ChromaDB context. Falls back to a         │
                    │  synonym/fuzzy heuristic if Ollama is down.       │
                    └───────────────────────┬───────────────────────────┘
                                             ▼
        ┌────────────────────────────────────────────────────────────────┐
        │                  Self-healing agent (LangGraph)                 │
        │                       app/agent/graph.py                        │
        │                                                                  │
        │   ┌──────────────┐  error   ┌──────┐  healed  ┌──────────────┐  │
        │   │ run_pipeline │─────────►│ heal │─────────►│ run_pipeline │  │
        │   └──────┬───────┘          └──┬───┘  (retry) └──────────────┘  │
        │          │ success             │ can't heal                    │
        │          ▼                     ▼                               │
        │         END              ┌─────────────┐                       │
        │                          │ human_review│──► data/human_review/ │
        │                          └─────────────┘     queue.jsonl       │
        │                                                                  │
        │  run_pipeline = cleaning (app/cleaning) -> validation            │
        │  (app/validation, Pydantic) -> dedup (app/deduplication,         │
        │  rapidfuzz) -> scoring (app/scoring, XGBoost)                    │
        │                                                                  │
        │  heal = capture traceback -> ask Ollama to rewrite                │
        │  app/cleaning/transforms.py -> validate the patch is syntactically│
        │  sound and didn't drop required functions -> write it to disk    │
        └────────────────────────────────────────────────────────────────┘
                                             ▼
                    ┌─────────────────────────────────────────────────┐
                    │     Postgres (leads, duplicates, invalid,        │
                    │     healing_events) + MLflow (scoring experiments)│
                    └───────────────────────┬───────────────────────────┘
                                             ▼
                              Streamlit dashboard (dashboard/)
```

## Tech stack and why

| Tool | Role | Why this one |
|---|---|---|
| **Ollama (qwen2.5:3b by default)** | Field-mapping LLM + code-patching LLM | Free, runs fully local, no API keys, no rate limits, no data leaves the machine -- required for a pipeline that ingests PII. 3b is the default so the whole stack fits comfortably in ~4GB of RAM; bump `OLLAMA_MODEL` to `qwen2.5:7b` in docker-compose.yml for better patch quality if your machine has 8GB+ to spare for Docker. |
| **LangGraph** | Self-healing agent orchestration | The retry/heal/human-review loop is a small explicit state machine, which is exactly what LangGraph's `StateGraph` models -- conditional edges instead of hand-rolled retry loops scattered through the code. |
| **FastAPI** | HTTP entrypoint | Async-native, Pydantic-native (shares the same validation models), minimal boilerplate for a handful of ingest/stats routes. |
| **pandas** | CSV parsing, batch transforms | Standard for tabular ingestion (Instagram/Google Form CSVs) and for feeding the DataFrame-shaped stats the dashboard needs. |
| **Pydantic** | Canonical schema + validation | Gives us one model (`app/schema/canonical.py:Lead`) that's simultaneously the validation layer, the FastAPI request/response shape, and the ML feature source of truth. |
| **PostgreSQL (DuckDB fallback)** | Storage | Postgres in docker-compose for concurrent read/write from the API + dashboard; DuckDB locally so the pipeline runs with zero infra for development. Same SQLAlchemy code path either way. |
| **ChromaDB** | RAG memory for field mapping | Stores canonical schema descriptions and every past field-mapping decision as embeddings, so mapping quality compounds instead of re-asking the LLM the same question for every batch. |
| **nomic-embed-text (via Ollama)** | Embeddings | Free, local, good enough for short field-name-plus-sample-value strings. |
| **XGBoost** | Lead scoring | Handles the mixed categorical/numeric feature set (source, consent, completeness) well with almost no tuning; falls back to a transparent rule-based scorer if no model has been trained yet. |
| **rapidfuzz** | Deduplication | Fast fuzzy string matching in C, with blocking (see `app/deduplication/dedup.py`) so dedup stays roughly linear instead of comparing every pair at 100k+ rows. |
| **MLflow** | Scoring experiment tracking | Free, local tracking server; logs the XGBoost hyperparameters/MAE for every training run. |
| **Streamlit** | Dashboard | Fastest way to get a real, interactive dashboard out of pandas DataFrames with no separate frontend build. |
| **Faker** | Synthetic data generation | Realistic names/emails/phones for the 100k+ row demo dataset. |
| **Docker Compose** | Orchestration | One command spins up Postgres, Ollama, ChromaDB, the API, and the dashboard together. |

## Project structure

```
leadpipe-doctor/
├── app/
│   ├── main.py            FastAPI entrypoint
│   ├── ingestion/          per-source raw-format parsers
│   ├── schema/              canonical Pydantic Lead model
│   ├── mapping/             schema profiling + LLM/RAG field mapping
│   ├── cleaning/            pandas transforms (the code the agent patches)
│   ├── validation/          Pydantic-based row validation
│   ├── deduplication/       rapidfuzz-based dedup
│   ├── scoring/             XGBoost + rule-based lead scoring
│   ├── agent/                LangGraph self-healing loop
│   └── utils/                config + storage
├── data/
│   ├── raw/                  generated messy source files
│   ├── processed/            local DuckDB file (dev mode)
│   └── human_review/         queue.jsonl of unrecoverable batches
├── scripts/
│   ├── generate_data.py      100k+ synthetic messy leads
│   └── demo_self_heal.py     intentionally breaks + heals the pipeline
├── ml/
│   ├── train.py               trains the XGBoost scorer
│   └── models/                 trained model artifact
├── dashboard/
│   └── streamlit_app.py
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Setup (3 commands)

```bash
docker compose up -d          # start Postgres, Ollama, ChromaDB, API, dashboard
docker compose exec ollama-init sh -c "ollama pull qwen2.5:3b && ollama pull nomic-embed-text"  # first run only, if ollama-init didn't finish
python scripts/generate_data.py --total 100000    # generate the demo dataset locally
```

Then open:
- API docs: http://localhost:8000/docs
- Dashboard: http://localhost:8501

To run without Docker (development mode, uses DuckDB instead of Postgres):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # terminal 1
streamlit run dashboard/streamlit_app.py   # terminal 2
```

In development mode, field mapping automatically falls back to the
synonym/fuzzy heuristic and self-healing routes straight to human review
if Ollama isn't running locally -- see Limitations.

## Demo walkthrough

1. **Load messy data**: `python scripts/generate_data.py --total 100000`
   generates `data/raw/{facebook,instagram,google_form,landing_page}_leads.*`
   with inconsistent phone formats, malformed emails, missing fields, and
   cross-source duplicates.
2. **Ingest and show clean output**: POST each file to its `/ingest/*`
   route (see `app/main.py`), then `GET /leads` or open the dashboard to
   see the canonical, validated, scored output.
3. **Break the schema intentionally**: `python -m scripts.demo_self_heal`
   patches `app/cleaning/transforms.py` with a bug (phone normalization
   stops casting input to `str`), then feeds it a batch with an integer
   phone number to trigger a real, uncaught `TypeError`.
4. **Show self-healing**: the same script's output shows the LangGraph
   agent catching the exception, asking Ollama to rewrite
   `transforms.py`, and successfully retrying -- or, if Ollama isn't
   running, routing straight to `data/human_review/queue.jsonl`.
5. **Show deduplication**: the dashboard's "Duplicates removed" metric and
   the union-find clustering in `app/deduplication/dedup.py` show
   cross-source duplicate detection on name/phone/email.
6. **Show scoring**: `python -m ml.train` trains the XGBoost model on
   bootstrapped rule-based pseudo-labels (see Limitations); afterward,
   `/leads` and the dashboard's score histogram reflect the trained
   model instead of the raw rule-based fallback.

## Limitations and future work

- **Model size is a memory/quality tradeoff.** `qwen2.5:3b` is the default
  because it reliably loads in ~4GB of RAM alongside Postgres, ChromaDB,
  and the API -- important on machines with 8GB total RAM, where Docker
  Desktop can't safely be given enough memory for `qwen2.5:7b` (a 7B model
  needs ~5-6GB+ of headroom on top of everything else and will get OOM-
  killed on a tight budget). If your machine has more RAM to spare, set
  `OLLAMA_MODEL: qwen2.5:7b` in docker-compose.yml (and pull it via
  `docker compose exec ollama-init ollama pull qwen2.5:7b`) for
  meaningfully better field-mapping and code-patching quality.
- **No real conversion labels.** The XGBoost scorer is trained on
  pseudo-labels derived from the rule-based scorer plus noise (see
  `ml/train.py`), since this demo has no historical "did this lead
  convert" outcome data. Swap in real labels once available -- nothing
  else in the pipeline needs to change, since scoring only depends on the
  saved model's `predict()` interface.
- **Self-healing has no offline fallback.** Rewriting code is
  fundamentally an LLM task; if Ollama is unreachable, the agent can't
  self-heal and routes straight to human review. Field mapping, by
  contrast, does have a heuristic fallback and keeps working offline.
- **Self-healing patches one file.** The agent is scoped to rewriting
  `app/cleaning/transforms.py` specifically. A bug in ingestion, mapping,
  validation, or scoring code is out of scope for this loop and would
  need the same pattern extended to those modules.
- **Dedup blocking key is last-name prefix.** Fast at 100k+ rows, but a
  lead whose name is wildly misspelled *and* has no shared email/phone
  with its duplicate could be missed. A production version would add a
  phonetic key (e.g. Soundex) as a second blocking pass.
- **Patch safety is syntax + required-function-presence only.** The agent
  validates that the LLM's rewritten file parses and keeps every expected
  function name, but doesn't run a full test suite against it before
  applying it. A stricter version would run existing unit tests against
  the patch before accepting it, and roll back automatically if the
  retry still fails.
