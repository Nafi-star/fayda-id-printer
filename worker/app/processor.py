from __future__ import annotations

from pathlib import Path
from typing import Literal

from PIL import Image

from app.config import settings
from app.schemas import ConversionJob, ConversionResult

ColorMode = Literal["color", "bw"]

# Printable ID-sized canvas (~3.4" × 2.1" at ~300 dpi)
CARD_W = 1016
CARD_H = 640
# Cap PDF raster longest side — enough for sharp downscale to the card, much faster than full 300dpi page.
PDF_RASTER_MAX_DIM = 1600


def _storage_paths() -> tuple[Path, Path]:
    custom = settings.storage_root.strip()
    root = Path(custom) if custom else Path(__file__).resolve().parents[2] / "storage"
    input_root = root / "input"
    output_root = root / "output"
    return input_root, output_root


def _letterbox_to_card(img: Image.Image, color_mode: ColorMode) -> Image.Image:
    if color_mode == "bw":
        work = img.convert("L").convert("RGB")
    else:
        work = img.convert("RGB")
    # Phone screenshots can be huge; pre-scale so thumbnail-to-card stays fast.
    max_in = max(work.size)
    if max_in > PDF_RASTER_MAX_DIM:
        work = work.copy()
        work.thumbnail((PDF_RASTER_MAX_DIM, PDF_RASTER_MAX_DIM), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (CARD_W, CARD_H), (255, 255, 255))
    img_copy = work.copy()
    img_copy.thumbnail((CARD_W, CARD_H), Image.Resampling.LANCZOS)
    x = (CARD_W - img_copy.width) // 2
    y = (CARD_H - img_copy.height) // 2
    canvas.paste(img_copy, (x, y))
    return canvas


def process_conversion_job(job: ConversionJob) -> ConversionResult:
    """
    Render first PDF page or a screenshot to a high-resolution PNG on a wallet-size canvas.
    """
    input_root, output_root = _storage_paths()
    input_path = input_root / Path(job.input_file_key)
    output_key = f"{job.output_prefix}/{job.job_id}.png"
    output_path = output_root / Path(output_key)
    color_mode: ColorMode = job.color_mode if job.color_mode in ("color", "bw") else "color"

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {job.input_file_key}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    suffix = input_path.suffix.lower()

    if suffix == ".pdf":
        import fitz

        doc = fitz.open(str(input_path))
        try:
            if len(doc) == 0:
                raise ValueError("PDF has no pages")
            page = doc.load_page(0)
            rect = page.rect
            w_pt, h_pt = rect.width, rect.height
            longest_pt = max(w_pt, h_pt)
            if longest_pt <= 0:
                raise ValueError("Invalid PDF page size")
            # Downscale huge pages to PDF_RASTER_MAX_DIM; never upscale beyond ~300 dpi equivalent.
            scale_pp = min(PDF_RASTER_MAX_DIM / longest_pt, 300 / 72)
            mat = fitz.Matrix(scale_pp, scale_pp)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pil_image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        finally:
            doc.close()
        card = _letterbox_to_card(pil_image, color_mode)
    else:
        with Image.open(input_path) as im:
            card = _letterbox_to_card(im, color_mode)

    # compress_level 3 is fast; avoid optimize=True (extra passes) for quicker saves.
    card.save(str(output_path), "PNG", compress_level=3)

    normalized_key = str(Path(output_key)).replace("\\", "/")
    return ConversionResult(
        job_id=job.job_id,
        status="completed",
        output_file_key=normalized_key,
    )
