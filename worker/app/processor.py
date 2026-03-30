from app.schemas import ConversionJob, ConversionResult


def process_conversion_job(job: ConversionJob) -> ConversionResult:
    """
    Stub conversion processor.
    Replace this with real PDF parsing/cropping/composition logic.
    """
    output_key = f"{job.output_prefix}/{job.job_id}.pdf"
    return ConversionResult(
        job_id=job.job_id,
        status="completed",
        output_file_key=output_key,
    )
