from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import shutil
import tempfile

from PIL import Image, ImageOps, UnidentifiedImageError


SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_WIDTH = 1600
MAX_HEIGHT = 1600
MAX_FILE_SIZE = 750 * 1024
JPEG_QUALITY = 82
WEBP_QUALITY = 82


@dataclass
class OptimizationResult:
    files: int = 0
    optimized: int = 0
    bytes_before: int = 0
    bytes_after: int = 0


def _save_options(image_format: str) -> dict:
    if image_format == "JPEG":
        return {
            "format": "JPEG",
            "quality": JPEG_QUALITY,
            "optimize": True,
            "progressive": True,
        }

    if image_format == "WEBP":
        return {
            "format": "WEBP",
            "quality": WEBP_QUALITY,
            "method": 6,
        }

    return {
        "format": "PNG",
        "optimize": True,
        "compress_level": 9,
    }


def _prepare_image(image: Image.Image, image_format: str) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    image.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.Resampling.LANCZOS)

    if image_format == "JPEG" and image.mode not in ("RGB", "L"):
        background = Image.new("RGB", image.size, "white")
        if "A" in image.getbands():
            background.paste(image, mask=image.getchannel("A"))
        else:
            background.paste(image)
        return background

    return image


def optimize_file(path: Path) -> tuple[int, int, bool]:
    size_before = path.stat().st_size

    try:
        with Image.open(path) as source:
            if getattr(source, "is_animated", False):
                return size_before, size_before, False

            image_format = source.format
            if image_format not in {"JPEG", "PNG", "WEBP"}:
                return size_before, size_before, False

            if (
                source.width <= MAX_WIDTH
                and source.height <= MAX_HEIGHT
                and size_before <= MAX_FILE_SIZE
            ):
                return size_before, size_before, False

            image = _prepare_image(source, image_format)
            with tempfile.NamedTemporaryFile(
                suffix=path.suffix,
                dir=path.parent,
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)

            try:
                image.save(temporary_path, **_save_options(image_format))
                size_after = temporary_path.stat().st_size

                if size_after >= size_before:
                    return size_before, size_before, False

                shutil.copystat(path, temporary_path)
                temporary_path.replace(path)
                return size_before, size_after, True
            finally:
                temporary_path.unlink(missing_ok=True)
    except (OSError, UnidentifiedImageError):
        return size_before, size_before, False


def optimize_directory(directory: Path) -> OptimizationResult:
    result = OptimizationResult()

    if not directory.exists():
        return result

    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue

        before, after, optimized = optimize_file(path)
        result.files += 1
        result.bytes_before += before
        result.bytes_after += after
        result.optimized += int(optimized)

    return result


def _size_label(size: int) -> str:
    return f"{size / 1024 / 1024:.1f} Mio"


def _print_result(label: str, result: OptimizationResult) -> None:
    saved = result.bytes_before - result.bytes_after
    print(
        f"{label}: {result.optimized}/{result.files} image(s) optimisée(s), "
        f"{_size_label(saved)} économisé(s)"
    )


def on_post_build(config, **kwargs) -> None:
    site_images = Path(config.site_dir) / "assets/images"
    _print_result("Images du site", optimize_directory(site_images))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Redimensionne et compresse les images du site sans changer leurs noms."
    )
    parser.add_argument(
        "--source",
        action="store_true",
        help="Optimise les images sources dans docs/assets/images.",
    )
    args = parser.parse_args()

    if not args.source:
        parser.error("utiliser --source pour modifier les images du dépôt")

    _print_result(
        "Images sources",
        optimize_directory(Path("docs/assets/images")),
    )


if __name__ == "__main__":
    main()
