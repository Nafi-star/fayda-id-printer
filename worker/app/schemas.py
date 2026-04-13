from typing import Literal

from pydantic import BaseModel, Field


class ConversionJob(BaseModel):
    job_id: str
    user_id: str
    input_file_key: str
    input_file_keys: list[str] | None = None
    output_prefix: str
    color_mode: Literal["color", "bw"] = Field(default="color")
    output_format: Literal["png", "pdf"] = Field(default="png")


class ConversionResult(BaseModel):
    job_id: str
    status: str
    output_file_key: str | None = None
    error_message: str | None = None
