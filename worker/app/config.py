from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fayda Worker"
    app_env: str = "development"
    log_level: str = "INFO"

    # Explicit aliases so Render/Railway env names (REDIS_URL, etc.) always map — no guessing.
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "redis_url"),
    )
    queue_name: str = Field(
        default="jobs:convert",
        validation_alias=AliasChoices("QUEUE_NAME", "queue_name"),
    )
    frontend_base_url: str = Field(
        default="http://127.0.0.1:3000",
        validation_alias=AliasChoices("FRONTEND_BASE_URL", "frontend_base_url"),
    )
    worker_callback_token: str = Field(
        default="dev-shared-token-change-me",
        validation_alias=AliasChoices("WORKER_CALLBACK_TOKEN", "worker_callback_token"),
    )

    storage_root: str = Field(default="", validation_alias=AliasChoices("STORAGE_ROOT", "storage_root"))

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/fayda_printer",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )

    s3_endpoint: str = Field(default="", validation_alias=AliasChoices("S3_ENDPOINT", "s3_endpoint"))
    s3_region: str = Field(default="us-east-1", validation_alias=AliasChoices("S3_REGION", "s3_region"))
    s3_access_key: str = Field(default="minioadmin", validation_alias=AliasChoices("S3_ACCESS_KEY", "s3_access_key"))
    s3_secret_key: str = Field(default="minioadmin", validation_alias=AliasChoices("S3_SECRET_KEY", "s3_secret_key"))
    s3_bucket_input: str = Field(
        default="fayda-input",
        validation_alias=AliasChoices("S3_BUCKET_INPUT", "s3_bucket_input"),
    )
    s3_bucket_output: str = Field(
        default="fayda-output",
        validation_alias=AliasChoices("S3_BUCKET_OUTPUT", "s3_bucket_output"),
    )
    s3_force_path_style: bool = Field(
        default=True,
        validation_alias=AliasChoices("S3_FORCE_PATH_STYLE", "s3_force_path_style"),
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("s3_force_path_style", mode="before")
    @classmethod
    def _env_bool(cls, v: object) -> bool:
        """Env vars are strings; bool('false') is True in Python, so parse explicitly."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            s = v.strip().lower()
            if s in ("", "0", "false", "no", "off"):
                return False
            if s in ("1", "true", "yes", "on"):
                return True
        return bool(v)


settings = Settings()
