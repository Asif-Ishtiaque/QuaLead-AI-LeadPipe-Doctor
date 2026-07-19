FROM python:3.11-slim

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chroma's bundled ONNX fallback embedding model (used only if Ollama is
# ever momentarily unreachable) downloads lazily on first *use*, not on
# import -- so a live request can trigger a real network download at
# request time. Confirmed live: on a slow connection this stalled at
# ~30-50KB/s for a 79MB file, blocking the single-worker API for 20+
# minutes on what looked like an unrelated ingest request. Downloading it
# here bakes it into the image so it's never a live download again,
# regardless of network conditions when the container actually runs.
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; DefaultEmbeddingFunction()(['warm'])"

COPY . .

EXPOSE 8000 8501

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
