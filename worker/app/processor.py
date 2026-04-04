from __future__ import annotations

import io
import logging
import time
from pathlib import Path
from typing import Literal

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from PIL import Image, ImageChops

from app.config import settings
from app.schemas import ConversionJob, ConversionResult

logger = logging.getLogger(__name__)

ColorMode = Literal["color", "bw"]

# Printable ID-sized canvas (~3.4" × 2.1" at ~300 dpi)
CARD_W = 1016
CARD_H = 640
# Cap PDF raster longest side — enough for sharp downscale to the card, much faster than full 300dpi page.
PDF_RASTER_MAX_DIM = 1600
# Quality multiplier for rendering. Keep near 1x so we don't rasterize huge pages.
PDF_RENDER_QUALITY_SCALE = 0.95
# Hard cap on equivalent DPI to keep rendering fast.
PDF_RENDER_DPI_CAP = 150

# If enabled, removes mostly-white borders before fitting to the card.
AUTO_CROP_ENABLED = True
# Threshold for near-white detection used by _auto_crop_margins.
# Higher value -> fewer pixels considered "content" -> tighter bbox -> more risk of cutting.
# Lower value -> more pixels treated as content -> safer (less aggressive cropping).
AUTO_CROP_WHITE_THRESHOLD = 235
# Padding added back around the detected content bbox.
# Keep small so we don't re-introduce whitespace; large enough to keep labels readable.
AUTO_CROP_PADDING_PX = 12

# Corner-background auto-crop is slower; run only as a fallback when quick crop
# failed to remove enough outer page whitespace.
AUTO_CROP_USE_CORNER_BACKGROUND = True

# Corner-background auto-crop settings:
# - We sample the top-left/top-right/bottom-left/bottom-right corners to estimate the background color.
# - Then we crop pixels that differ from that background.
#
# Works better than "near-white" when the background is light teal/gray instead of pure white.
# Larger sample gives a better estimate of background color.
AUTO_CROP_CORNER_SAMPLE_SIZE = 16  # px
# Lower tolerance = more aggressive cropping (less leftover margins).
AUTO_CROP_CORNER_TOLERANCE = 10  # 0-255 avg color-distance threshold


_s3_client = None
_s3_buckets_initialized = False


def _resolve_storage_root() -> Path:
    """
    Resolve the shared storage root used by Next.js:
    - If settings.storage_root is set, use it.
    - Otherwise fall back to repo-level ./storage.
    """
    if settings.storage_root:
        return Path(settings.storage_root)
    # processor.py: <repo>/worker/app/processor.py -> repo root is parents[2]
    return Path(__file__).resolve().parents[2] / "storage"


def _local_input_path(input_key: str) -> Path:
    return _resolve_storage_root() / "input" / Path(input_key)


def _local_output_path(output_key: str) -> Path:
    return _resolve_storage_root() / "output" / Path(output_key)


def _get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    addressing_style = "path" if settings.s3_force_path_style else "auto"
    _s3_client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=BotoConfig(s3={"addressing_style": addressing_style}),
    )
    return _s3_client


def _ensure_s3_buckets() -> None:
    global _s3_buckets_initialized
    if _s3_buckets_initialized:
        return

    s3 = _get_s3_client()
    for bucket in [settings.s3_bucket_input, settings.s3_bucket_output]:
        try:
            s3.head_bucket(Bucket=bucket)
        except ClientError:
            try:
                s3.create_bucket(Bucket=bucket)
            except ClientError:
                # Ignore: bucket might already exist or the backend may deny creation.
                pass

    _s3_buckets_initialized = True


def _auto_crop_margins(work_rgb: Image.Image) -> Image.Image:
    """
    Crop near-white margins to reduce extra whitespace around the ID.
    This is intentionally conservative (near-white only) to avoid cutting dark content.
    """
    # diff is 0 for identical pixels; near-white areas become tiny diffs.
    white_bg = Image.new("RGB", work_rgb.size, (255, 255, 255))
    diff = ImageChops.difference(work_rgb, white_bg).convert("L")

    # Build a binary mask of "not-white enough" pixels.
    mask = diff.point(lambda p: 255 if p > AUTO_CROP_WHITE_THRESHOLD else 0)
    bbox = mask.getbbox()
    if not bbox:
        return work_rgb

    left, top, right, bottom = bbox
    left = max(0, left - AUTO_CROP_PADDING_PX)
    top = max(0, top - AUTO_CROP_PADDING_PX)
    right = min(work_rgb.width, right + AUTO_CROP_PADDING_PX)
    bottom = min(work_rgb.height, bottom + AUTO_CROP_PADDING_PX)
    return work_rgb.crop((left, top, right, bottom))


def _auto_crop_by_corner_background(work_rgb: Image.Image) -> Image.Image:
    """
    Crop margins by detecting the page background color from the image corners.
    This reduces leftover whitespace when the background isn't pure white.
    """
    w, h = work_rgb.size
    if w < 10 or h < 10:
        return work_rgb

    sample = AUTO_CROP_CORNER_SAMPLE_SIZE
    tl = work_rgb.crop((0, 0, min(sample, w), min(sample, h)))
    tr = work_rgb.crop((max(0, w - sample), 0, w, min(sample, h)))
    bl = work_rgb.crop((0, max(0, h - sample), min(sample, w), h))
    br = work_rgb.crop((max(0, w - sample), max(0, h - sample), w, h))

    # Compute mean background color across corner patches.
    def _mean_rgb(img: Image.Image) -> tuple[float, float, float]:
        # histogram per channel
        r, g, b = img.split()
        hr = r.histogram()
        hg = g.histogram()
        hb = b.histogram()
        total = sum(hr)
        if total == 0:
            return (255.0, 255.0, 255.0)
        mr = sum(i * v for i, v in enumerate(hr)) / total
        mg = sum(i * v for i, v in enumerate(hg)) / total
        mb = sum(i * v for i, v in enumerate(hb)) / total
        return (mr, mg, mb)

    brd = _mean_rgb(tl)
    trd = _mean_rgb(tr)
    bld = _mean_rgb(bl)
    brr = _mean_rgb(br)

    bg_r = (brd[0] + trd[0] + bld[0] + brr[0]) / 4.0
    bg_g = (brd[1] + trd[1] + bld[1] + brr[1]) / 4.0
    bg_b = (brd[2] + trd[2] + bld[2] + brr[2]) / 4.0

    # Build mask of pixels that differ enough from the background.
    # For performance, run bbox detection on a downscaled copy.
    work_rgb = work_rgb.convert("RGB")
    max_det_dim = 520
    scale = 1.0
    if max(w, h) > max_det_dim:
        scale = max_det_dim / float(max(w, h))

    det_w = max(1, int(round(w * scale)))
    det_h = max(1, int(round(h * scale)))
    det_img = work_rgb.resize((det_w, det_h), Image.Resampling.LANCZOS)
    det_pixels = det_img.load()
    det_mask = Image.new("L", (det_w, det_h), 0)
    det_mpix = det_mask.load()

    tol = float(AUTO_CROP_CORNER_TOLERANCE)
    any_masked = False
    for y in range(det_h):
        for x in range(det_w):
            r, g, b = det_pixels[x, y]
            d = (abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)) / 3.0
            if d > tol:
                det_mpix[x, y] = 255
                any_masked = True

    if not any_masked:
        return work_rgb

    bbox = det_mask.getbbox()
    if not bbox:
        return work_rgb

    left, top, right, bottom = bbox
    # Map bbox back to original image coordinates.
    if scale != 0:
        left = int(left / scale)
        top = int(top / scale)
        right = int(right / scale)
        bottom = int(bottom / scale)
    left = max(0, left - AUTO_CROP_PADDING_PX)
    top = max(0, top - AUTO_CROP_PADDING_PX)
    right = min(w, right + AUTO_CROP_PADDING_PX)
    bottom = min(h, bottom + AUTO_CROP_PADDING_PX)

    cropped = work_rgb.crop((left, top, right, bottom))

    # Safety: if cropping didn't meaningfully reduce size, fall back.
    orig_area = w * h
    new_area = cropped.size[0] * cropped.size[1]
    area_ratio = new_area / orig_area
    if area_ratio > 0.90 or area_ratio < 0.05:
        return work_rgb

    return cropped


def _fit_to_card(img: Image.Image, color_mode: ColorMode) -> Image.Image:
    """
    Full ID visible, no outer page margins, no letterbox canvas:
    - Auto-crop trims scanner/PDF whitespace around the card.
    - Uniform resize so the longest side matches OUTPUT_MAX_PX (~print-ready);
      aspect ratio is preserved, so nothing is cropped and no white bars are added.
    """
    work_rgb = img.convert("RGB")

    # Phone screenshots can be huge; pre-scale so cropping stays fast.
    max_in = max(work_rgb.size)
    if max_in > PDF_RASTER_MAX_DIM:
        work_rgb.thumbnail((PDF_RASTER_MAX_DIM, PDF_RASTER_MAX_DIM), Image.Resampling.LANCZOS)

    if AUTO_CROP_ENABLED:
        orig_w, orig_h = work_rgb.size
        # Fast first pass: near-white crop.
        fast_crop = _auto_crop_margins(work_rgb)
        work_rgb = fast_crop

        # If fast crop barely changed area, we likely still have big page margins.
        # Then use corner-background crop as a stronger fallback.
        if AUTO_CROP_USE_CORNER_BACKGROUND:
            orig_area = max(1, orig_w * orig_h)
            fast_area = work_rgb.size[0] * work_rgb.size[1]
            fast_ratio = fast_area / orig_area
            if fast_ratio > 0.78:
                stronger = _auto_crop_by_corner_background(work_rgb)
                if stronger.size != work_rgb.size:
                    work_rgb = stronger

    src_w, src_h = work_rgb.size
    if src_w <= 0 or src_h <= 0:
        return Image.new("RGB", (CARD_W, CARD_H), (255, 255, 255))

    # Wallet-class resolution: match ~long side of nominal card canvas, no cropping.
    output_max_px = max(CARD_W, CARD_H)
    longest = max(src_w, src_h)
    scale = output_max_px / float(longest)
    dst_w = max(1, int(round(src_w * scale)))
    dst_h = max(1, int(round(src_h * scale)))
    out = work_rgb.resize((dst_w, dst_h), Image.Resampling.LANCZOS)

    if color_mode == "bw":
        return out.convert("L").convert("RGB")
    return out


def process_conversion_job(job: ConversionJob) -> ConversionResult:
    """
    Render first PDF page or a screenshot to a high-resolution PNG (auto-cropped, aspect preserved).
    """
    start_t = time.perf_counter()
    input_key = job.input_file_key
    output_key = f"{job.output_prefix}/{job.job_id}.png"
    color_mode: ColorMode = job.color_mode if job.color_mode in ("color", "bw") else "color"

    _ensure_s3_buckets()
    s3 = _get_s3_client()

    # Download input bytes from S3.
    t_download0 = time.perf_counter()
    try:
        resp = s3.get_object(Bucket=settings.s3_bucket_input, Key=input_key)
        input_bytes = resp["Body"].read()
    except Exception as exc:
        # Local dev can run with Next.js uploading to filesystem while the worker
        # still expects S3. Fall back to the shared local storage directory.
        local_path = _local_input_path(input_key)
        if local_path.exists():
            logger.warning(
                "S3 input missing; using local file. key=%s local=%s",
                input_key,
                str(local_path),
            )
            input_bytes = local_path.read_bytes()
        else:
            raise FileNotFoundError(f"Input file not found in S3: {input_key}") from exc
    t_download1 = time.perf_counter()

    suffix = Path(input_key).suffix.lower()
    if suffix == ".pdf":
        import fitz

        doc = fitz.open(stream=input_bytes, filetype="pdf")
        try:
            if len(doc) == 0:
                raise ValueError("PDF has no pages")
            page = doc.load_page(0)
            rect = page.rect
            w_pt, h_pt = rect.width, rect.height
            longest_pt = max(w_pt, h_pt)
            if longest_pt <= 0:
                raise ValueError("Invalid PDF page size")
            # Render full page in view (contain): never clip PDF content at raster time.
            # w_pt/h_pt are in PDF points; matrix scale converts points -> pixels.
            scale_fit_w = (CARD_W * PDF_RENDER_QUALITY_SCALE) / w_pt
            scale_fit_h = (CARD_H * PDF_RENDER_QUALITY_SCALE) / h_pt
            scale_pp = min(scale_fit_w, scale_fit_h, PDF_RENDER_DPI_CAP / 72)
            mat = fitz.Matrix(scale_pp, scale_pp)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pil_image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        finally:
            doc.close()

        card = _fit_to_card(pil_image, color_mode)
    else:
        with Image.open(io.BytesIO(input_bytes)) as im:
            card = _fit_to_card(im, color_mode)

    # compress_level 3 is fast; avoid optimize=True (extra passes) for quicker saves.
    t_encode0 = time.perf_counter()
    out_buf = io.BytesIO()
    # Faster PNG save. File size is not a problem for printing.
    card.save(out_buf, format="PNG", compress_level=1)
    out_buf.seek(0)
    t_encode1 = time.perf_counter()

    png_bytes = out_buf.getvalue()

    # Upload output to S3 (primary storage for Vercel + remote worker deployment).
    t_upload0 = time.perf_counter()
    try:
        s3.put_object(
            Bucket=settings.s3_bucket_output,
            Key=output_key,
            Body=png_bytes,
            ContentType="image/png",
        )
    except Exception:
        logger.exception("S3 upload failed. key=%s", output_key)
        raise
    t_upload1 = time.perf_counter()

    # Note: render time is roughly included between download and encode.
    logger.info(
        "job=%s download=%.2fs encode=%.2fs upload=%.2fs total=%.2fs inputBytes=%d",
        job.job_id,
        t_download1 - t_download0,
        t_encode1 - t_encode0,
        t_upload1 - t_upload0,
        time.perf_counter() - start_t,
        len(input_bytes),
    )

    return ConversionResult(
        job_id=job.job_id,
        status="completed",
        output_file_key=str(Path(output_key)).replace("\\", "/"),
    )
