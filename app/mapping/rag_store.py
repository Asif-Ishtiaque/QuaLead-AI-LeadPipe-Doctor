"""ChromaDB-backed memory for field mapping.

Two collections:
  - "canonical_schema": one entry per canonical field, embedding its
    human-readable description. This is the RAG context the LLM is grounded
    in when guessing a mapping.
  - "field_mappings": one entry per (source, field_name) the mapper has
    already resolved, so repeat batches from the same source reuse a past
    decision instead of re-asking the LLM every time -- this is how mapping
    "improves over time" as required by the brief.

Embeddings are produced by the local Ollama `nomic-embed-text` model. If
Ollama isn't running, we transparently fall back to Chroma's bundled
default embedding function so schema profiling still works end-to-end
without any external service.
"""

from __future__ import annotations

import os
from functools import lru_cache

import chromadb
from chromadb.utils import embedding_functions

from app.mapping.llm_client import OllamaUnavailable, embed
from app.schema.canonical import CANONICAL_FIELD_DESCRIPTIONS
from app.utils.config import settings


class OllamaEmbeddingFunction(embedding_functions.EmbeddingFunction):
    """Chroma embedding function backed by Ollama, falling back to Chroma's
    local default (ONNX MiniLM) model if Ollama can't be reached."""

    def __init__(self) -> None:
        self._fallback = embedding_functions.DefaultEmbeddingFunction()

    def __call__(self, input: list[str]) -> list[list[float]]:
        try:
            return [embed(text) for text in input]
        except OllamaUnavailable:
            return self._fallback(input)


@lru_cache(maxsize=1)
def get_client() -> chromadb.ClientAPI:
    if os.getenv("CHROMA_HOST"):
        return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
    return chromadb.PersistentClient(path=settings.chroma_persist_dir)


@lru_cache(maxsize=1)
def get_embedding_fn() -> OllamaEmbeddingFunction:
    return OllamaEmbeddingFunction()


def get_canonical_schema_collection():
    client = get_client()
    collection = client.get_or_create_collection(
        "canonical_schema", embedding_function=get_embedding_fn()
    )
    if collection.count() == 0:
        collection.add(
            ids=list(CANONICAL_FIELD_DESCRIPTIONS.keys()),
            documents=list(CANONICAL_FIELD_DESCRIPTIONS.values()),
            metadatas=[{"field": f} for f in CANONICAL_FIELD_DESCRIPTIONS],
        )
    return collection


def get_field_mappings_collection():
    client = get_client()
    return client.get_or_create_collection(
        "field_mappings", embedding_function=get_embedding_fn()
    )


def lookup_known_mapping(source: str, field_name: str) -> str | None:
    """Exact-match lookup: has this (source, field_name) pair already been
    mapped before? Returns the canonical field name, or None."""
    collection = get_field_mappings_collection()
    result = collection.get(ids=[f"{source}:{field_name}"])
    if result["ids"]:
        return result["metadatas"][0]["canonical_field"]
    return None


def remember_mapping(source: str, field_name: str, canonical_field: str, sample_value: str) -> None:
    collection = get_field_mappings_collection()
    collection.upsert(
        ids=[f"{source}:{field_name}"],
        documents=[f"{field_name}: {sample_value}"],
        metadatas=[{"source": source, "field_name": field_name, "canonical_field": canonical_field}],
    )


def query_similar_canonical_fields(field_name: str, sample_value: str, top_k: int = 3) -> list[dict]:
    collection = get_canonical_schema_collection()
    result = collection.query(
        query_texts=[f"{field_name}: {sample_value}"],
        n_results=top_k,
    )
    return [
        {"field": meta["field"], "description": doc}
        for meta, doc in zip(result["metadatas"][0], result["documents"][0])
    ]
