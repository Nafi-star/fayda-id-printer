from pydantic import BaseModel


class ConversionJob(BaseModel):
    job_id: str
    user_id: str
    input_file_key: str
    output_prefix: str


class ConversionResult(BaseModel):
    job_id: str
    status: str
    output_file_key: str | None = None
    error_message: str | None = None
