from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fayda Worker"
    app_env: str = "development"
    log_level: str = "INFO"

    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "jobs:convert"
    frontend_base_url: str = "http://127.0.0.1:3000"
    # Must match frontend WORKER_CALLBACK_TOKEN (see frontend/.env.local.example).
    worker_callback_token: str = "dev-shared-token-change-me"

    # Absolute path shared with Next.js (input/ and output/ live under here). Empty = repo ../storage
    storage_root: str = ""

    database_url: str = "postgresql://postgres:postgres@localhost:5432/fayda_printer"

    # Empty = use shared ./storage with Next.js (no MinIO). Set all S3_* vars to use object storage.
    s3_endpoint: str = ""
    s3_region: str = "us-east-1"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_input: str = "fayda-input"
    s3_bucket_output: str = "fayda-output"
    s3_force_path_style: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
