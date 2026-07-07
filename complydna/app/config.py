from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ComplyDNA"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    qdrant_path: str | None = "data/qdrant"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "mevzuat_v1"
    embedding_model: str = "BAAI/bge-m3"
    index_version: str = "v1"
    model_version: str = "dev-stub-v1"
    llm_provider: str = "stub"
    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "llama3.2"
    llm_api_key: str = ""
    llm_timeout_seconds: float = 120.0
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"
    posthog_service_name: str = "complydna"
    posthog_distinct_id: str = ""
    api_key: str = "complydna_sk_test_local"
    rate_limit_per_minute: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
