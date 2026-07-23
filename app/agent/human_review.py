"""Landing spot for batches the self-healing loop couldn't recover, either
because the LLM proposed a bad patch or Ollama wasn't reachable. Each entry
is one line of JSON so the dashboard and API can tail/append cheaply."""

import json
from pathlib import Path
from typing import Any

QUEUE_PATH = Path(__file__).resolve().parents[2] / "data" / "human_review" / "queue.jsonl"


def enqueue(source: str, raw_data: Any, reason: str, error_message: str, retries_used: int) -> None:
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "source": source,
        "raw_data": raw_data,
        "reason": reason,
        "error_message": error_message,
        "retries_used": retries_used,
    }
    with QUEUE_PATH.open("a") as f:
        f.write(json.dumps(entry, default=str) + "\n")


def read_all() -> list[dict[str, Any]]:
    if not QUEUE_PATH.exists():
        return []
    with QUEUE_PATH.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def clear() -> int:
    """Empty the review queue (used by the workspace reset). Returns how many
    entries were removed."""
    n = len(read_all())
    if QUEUE_PATH.exists():
        QUEUE_PATH.unlink()
    return n
