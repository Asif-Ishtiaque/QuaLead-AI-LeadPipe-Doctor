"""Thin HTTP client for a local Ollama instance. No paid API is ever
called -- if Ollama isn't reachable (e.g. running this repo without Docker),
callers are expected to catch OllamaUnavailable and fall back to a
heuristic/rule-based path instead of hard-failing the whole pipeline."""

from __future__ import annotations

import json

import requests

from app.utils.config import settings


class OllamaUnavailable(RuntimeError):
    """Raised when the local Ollama daemon can't be reached or errors out."""


def generate(prompt: str, system: str | None = None, timeout: float = 30.0) -> str:
    try:
        resp = requests.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "system": system or "",
                "stream": False,
                "options": {"temperature": 0.1},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()["response"]
    except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
        raise OllamaUnavailable(str(exc)) from exc


def embed(text: str, timeout: float = 15.0) -> list[float]:
    try:
        resp = requests.post(
            f"{settings.ollama_host}/api/embeddings",
            json={"model": settings.embedding_model, "prompt": text},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()["embedding"]
    except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
        raise OllamaUnavailable(str(exc)) from exc


def extract_json(text: str) -> dict:
    """LLMs love wrapping JSON in prose or code fences. Pull out the first
    {...} block and parse it."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No JSON object found in LLM response: {text!r}")
    return json.loads(text[start : end + 1])
