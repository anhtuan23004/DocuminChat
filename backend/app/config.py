import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse


@dataclass
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./.data/local.db")
    )
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", ".data/uploads")))
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", ""))
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", ""))
    llm_timeout_seconds: float = field(
        default_factory=lambda: float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
    )
    max_upload_bytes: int = 20 * 1024 * 1024
    max_context_chars: int = 16000

    def validate(self):
        if self.app_env != "development":
            raise RuntimeError(
                "Local identity is only available in APP_ENV=development. Add real auth before deployment."
            )
        if self.llm_base_url:
            url = urlparse(self.llm_base_url)
            if (
                url.scheme not in {"http", "https"}
                or not url.hostname
                or url.query
                or url.fragment
                or url.username
            ):
                raise RuntimeError(
                    "LLM_BASE_URL must be an absolute HTTP(S) URL without credentials/query."
                )
        self.data_dir.mkdir(parents=True, exist_ok=True)

    @property
    def model_configured(self):
        return bool(self.llm_base_url and self.llm_model)
