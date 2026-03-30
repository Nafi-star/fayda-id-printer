from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fayda Worker"
    app_env: str = "development"
    log_level: str = "INFO"

    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "jobs:convert"
    frontend_base_url: str = "http://localhost:3000"
    worker_callback_token: str = "replace-with-shared-token"

    database_url: str = "postgresql://postgres:postgres@localhost:5432/fayda_printer"

    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_input: str = "fayda-input"
    s3_bucket_output: str = "fayda-output"
    s3_force_path_style: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
