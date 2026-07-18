"""Demo: intentionally break the cleaning engine, then watch the agent
self-heal it.

Requires Ollama to actually be running and reachable (see docker-compose.yml
/ README) -- healing is an LLM-driven step and has no offline fallback.

Run with: python -m scripts.demo_self_heal
"""

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent.graph import run_self_healing  # noqa: E402
from app.schema.canonical import LeadSource  # noqa: E402

TRANSFORMS_PATH = Path(__file__).resolve().parents[1] / "app" / "cleaning" / "transforms.py"

BROKEN_NORMALIZE_PHONE = '''    if value is None:
        return None
    parsed = phonenumbers.parse(value, default_region)  # BUG: no str(value) cast, breaks on non-str input
    if not phonenumbers.is_valid_number(parsed):
        return None
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)'''

GOOD_NORMALIZE_PHONE = '''    if value is None:
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
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)'''


def break_schema():
    source = TRANSFORMS_PATH.read_text()
    if GOOD_NORMALIZE_PHONE not in source:
        raise RuntimeError("transforms.py doesn't match the expected baseline -- refusing to patch it blind")
    broken = source.replace(GOOD_NORMALIZE_PHONE, BROKEN_NORMALIZE_PHONE)
    demo_backup = TRANSFORMS_PATH.with_suffix(".py.demo_backup")
    shutil.copy(TRANSFORMS_PATH, demo_backup)
    TRANSFORMS_PATH.write_text(broken)
    print(f"Intentionally broke {TRANSFORMS_PATH} (original saved at {demo_backup}).")
    print("normalize_phone() now crashes on non-string input (e.g. a raw int phone number).\n")


def demo_landing_page_batch_with_int_phone():
    return {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.com",
        "mobile": 14155550100,  # int, not str -- this is what trips the bug
        "consent": True,
        "ts": "2026-07-18T10:00:00Z",
        "utm_campaign": "demo",
    }


def main():
    break_schema()

    print("Running the pipeline on a batch that triggers the bug...")
    final_state = run_self_healing(LeadSource.LANDING_PAGE, demo_landing_page_batch_with_int_phone())

    print(f"\nFinal status: {final_state['status']}")
    print(f"Healing events: {final_state['healing_events']}")

    if final_state["status"] == "success":
        print("\nSelf-healing succeeded -- transforms.py was patched by the LLM and the retry passed.")
        for lead in final_state["result"].scored_leads:
            print(lead.model_dump())
    else:
        print("\nCould not self-heal (Ollama unreachable, or the LLM's patch was rejected).")
        print("Batch was sent to the human_review queue: data/human_review/queue.jsonl")


if __name__ == "__main__":
    main()
