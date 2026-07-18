"""Central runtime configuration, read from environment variables so the
same code runs both on a bare metal `python3` invocation (for local testing)
and inside the docker-compose services."""

import os


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL", "duckdb:///./data/processed/leadpipe.duckdb"
    )
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
    chroma_host: str = os.getenv("CHROMA_HOST", "localhost")
    chroma_port: int = int(os.getenv("CHROMA_PORT", "8001"))
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_persist")
    mlflow_tracking_uri: str = os.getenv("MLFLOW_TRACKING_URI", "./ml/mlruns")
    max_self_heal_retries: int = int(os.getenv("MAX_SELF_HEAL_RETRIES", "3"))


settings = Settings()
