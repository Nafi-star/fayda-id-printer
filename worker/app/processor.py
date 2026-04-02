from __future__ import annotations

from pathlib import Path
from typing import Literal

from PIL import Image, ImageOps

from app.schemas import ConversionJob, ConversionResult

ColorMode = Literal["color", "bw"]

# Printable ID-sized canvas (~3.4" × 2.1" at ~300 dpi)
CARD_W = 1016
CARD_H = 640


def _storage_paths() -> tuple[Path, Path]:
    root = Path(__file__).resolve().parents[2] / "storage"
    input_root = root / "input"
    output_root = root / "output"
    return input_root, output_root


def _letterbox_to_card(img: Image.Image, color_mode: ColorMode) -> Image.Image:
    if color_mode == "bw":
        img = img.convert("L").convert("RGB")
    else:
        img = img.convert("RGB")
    canvas = Image.new("RGB", (CARD_W, CARD_H), (255, 255, 255))
    img_copy = img.copy()
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
            zoom = 300 / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pil_image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        finally:
            doc.close()
        card = _letterbox_to_card(pil_image, color_mode)
    else:
        with Image.open(input_path) as im:
            card = _letterbox_to_card(im, color_mode)

    if job.print_layout == "mirrored":
        card = ImageOps.mirror(card)

    card.save(str(output_path), "PNG", optimize=True)

    normalized_key = str(Path(output_key)).replace("\\", "/")
    return ConversionResult(
        job_id=job.job_id,
        status="completed",
        output_file_key=normalized_key,
    )
