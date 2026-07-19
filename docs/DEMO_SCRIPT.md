# Demo video script (max 4:00)

Recording tool: OBS Studio. Record from an already-tested run -- do not
improvise the schema-drift/self-heal segment live. Its LLM generation is
CPU-bound and its wall time scales with the current size of
`app/cleaning/transforms.py` (it rewrites the whole file) -- that file has
grown across QA rounds, and a fresh QA pass on 2026-07-19 measured a real
run at **~6 minutes** (~3.25 tokens/sec on this 8GB Mac), well past the
1.5-2.5 minute figure this doc used to cite. Re-time this segment with a
rehearsal run immediately before recording -- don't trust an old number,
this file will likely keep growing.

**Before recording Scene 4 specifically**, send one throwaway prompt to
warm Ollama up:
```bash
curl -s http://localhost:11434/api/generate -d '{"model":"qwen2.5:3b","prompt":"say OK","stream":false}'
```
A QA pass found that if the model has been idle and gets unloaded from
memory, the *first* request afterward can fail fast with an HTTP 500
(not just load slowly) -- which would make self-healing bail out
immediately with zero retries instead of the real ~6-minute patch
attempt. Warming it up first avoids recording a false failure.

## Before you hit record: reset to a clean, predictable state

```bash
docker compose down -v          # wipes Postgres/Chroma/Ollama volumes -- fresh state
docker compose up -d
# wait for `docker compose logs -f ollama-init` to print "success" twice
# (qwen2.5:3b, then nomic-embed-text)
```

Then, in this exact order, so the numbers you narrate match what's on
screen and the Marie Curie example ends up as the newest (easiest to
find) rows -- use `python3`, not `python` (macOS has no bare `python`):

```bash
python3 -m scripts.replay                                    # scene 3: the ~100k sample pack
curl -s -X POST http://localhost:8000/ingest/landing-page \
  -H "Content-Type: application/json" \
  --data-binary @data/demo_dedup_scoring_example.json       # scene 5: the dedup+scoring pair
python3 -m ml.train                                          # scene 6: a real MLflow run to show
```

Confirm before recording:
- Dashboard (http://localhost:8501) shows ~30.5k clean leads, ~3.8k
  flagged, ~3k duplicates, ~62k invalid (these are the real, reproducible
  numbers this exact sample pack + seed produces; "flagged" is leads that
  passed validation but tripped a quality concern -- disposable email,
  obviously-fake test address, keyboard-mash name -- separate from
  "clean"). The dashboard is now tabbed (Overview / Data Quality /
  Self-Healing / Explore Leads) -- these totals are the KPI cards at the
  top, visible from any tab.
- `curl -s localhost:8000/leads?limit=100000 | python3 -c "import json,sys;print([r for r in json.load(sys.stdin) if r['last_name']=='Curie'])"`
  shows the kept Marie Curie record around 70 quality score
- MLflow (http://localhost:5000) shows a run under experiment
  `leadpipe-doctor-scoring` with a logged MAE

---

## Scene 1 -- The problem (0:00-0:25)

**On screen:** 4 raw sample files open side by side in an editor or
terminal -- `data/sample_pack/facebook_leads.jsonl`,
`instagram_export.csv`, `google_form.csv`,
`landing_page.jsonl`. Point out the same-ish person appears
differently formatted in each (different field names, different phone
formats).

**Say:** *"We pay for every lead, then lose it in the pipe. Four sources,
four different field names, four different phone formats -- and every
pipeline eventually breaks on a shape it's never seen before. This is
LeadPipe Doctor: it cleans all of this automatically, and when its own
code breaks, it fixes itself."*

## Scene 2 -- One command up (0:25-0:50)

**Where to type:** a terminal window.

**On screen:** run `docker compose up -d`, let the service list print.

**Say:** *"One command starts everything -- Postgres, a local vector
store, and a local LLM through Ollama. No OpenAI, no API keys, nothing
paid, anywhere in this stack -- the tool table in the README lists every
license."*

## Scene 3 -- Leads flow live (0:50-1:30)

**Where to type:** the same terminal window for the replay command; the
dashboard (http://localhost:8501, **Overview** tab -- it's the default
tab) for the KPI cards; a browser or terminal for `GET /leads`.

**On screen:** run `python3 -m scripts.replay`, cut to the dashboard's
Overview tab filling in with numbers (speed this segment up if the
ingestion itself takes more than a few seconds on camera -- it's
mapping-cache-dependent). Then open `GET /leads` in the API docs or
terminal and scroll to one record, pointing at `raw_payload` next to the
cleaned fields on the same row.

**Say:** *"Here's one lead's entire journey in a single row -- the exact
messy dict it arrived as, sitting right next to the clean, validated,
canonical version Postgres actually stores."*

## Scene 4 -- The kill shot (1:30-2:50)

**Where to type:** an editor for the transforms.py diff; a terminal for
`python3 -m scripts.demo_self_heal` (this is the fixture that breaks the
file, runs the pipeline, and restores the original file automatically);
the agent's stdout log for the healing narration.

**On screen (pre-recorded, from an already-tested run):**
1. Show the `app/cleaning/transforms.py` diff being broken (or just state
   it) -- phone cleaning no longer casts input to text.
2. Send a lead with a phone number written as a plain number. Show the
   crash / red error with its traceback.
3. Show the agent's log: catching the exception, calling the local LLM.
4. **Speed up or cut** the thinking time here -- it's currently ~6
   minutes on this machine (re-time it with a rehearsal run right before
   recording, see the note at the top of this doc) -- overlay text:
   *"Local AI rewriting its own code, no internet used..."*
5. Show green: retry succeeds, the lead comes through with a fixed phone
   number. Zero human touch the entire time.

**Say:** *"Watch what happens when its own code breaks. [error] It
catches the exception, hands the traceback and the broken file to a
local model, and rewrites the fix itself. [retry succeeds] Zero human
touch."*

**Honesty line (say this explicitly):** *"These four sources are
simulated in authentic payload formats -- real Facebook webhook JSON
shape, real Google Forms CSV shape. In production this same code points
at the real webhook URLs instead."*

## Scene 5 -- Dedupe + scoring (2:50-3:20)

**Where to type:** the dashboard's **Explore Leads** tab, search box
("curie") for the kept record; the **Overview** tab's "Recent
duplicates" table (bottom of the page) for the duplicate -- they're on
different tabs now that the dashboard is tabbed, so cut between the two
or show both panels in the same recorded pass.

**On screen:** the two Marie Curie records from
`data/demo_dedup_scoring_example.json` -- one dashboard/API view showing
both: kept record around **70**, the duplicate around **25**.

**Say:** *"Same person, two submissions. This one included consent and a
campaign tag and scored higher. The other had no consent and less
information -- scored lower, correctly identified as the weaker
duplicate and merged out."*

(Note: use the real numbers above, not a fixed script number -- they're
deterministic for this exact fixture, but say whatever your screen
actually shows.)

## Scene 6 -- The stack (3:20-3:55)

**On screen:** MLflow run page (accuracy/MAE metric), the LangGraph state
graph (sketch it or show `app/agent/graph.py`), the repo tree.

**Say:** *"XGBoost scoring, tracked in MLflow. A LangGraph state machine
for the self-healing loop. Built for the hackathon, 100% free and open
source."*

## Wrap (3:55-4:00)

**Say:** *"Repo link and tool licenses are in the description. Thanks for
watching."*

---

## Submission checklist

- [ ] Video is under 4:00
- [ ] Uploaded / linked, and the link is pasted into README's "Demo
      video" section
- [ ] Slack message includes: team name, repo URL, video link, 2-line
      pitch
- [ ] Submitted with a 30-minute buffer before the deadline
