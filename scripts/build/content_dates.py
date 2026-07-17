from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import quote, unquote

BUILD_DIR = Path(__file__).resolve().parent
if str(BUILD_DIR) not in sys.path:
    sys.path.insert(0, str(BUILD_DIR))

from content_utils import (
    git_update_date as _git_update_date,
    plain_excerpt,
)


CONTENT_DIRS = (
    "contenus/actualites/posts/",
    "contenus/ressources/posts/",
)
ASSET_IMAGE_PREFIXES = ("/assets/images/", "assets/images/")


def _card_excerpt(markdown: str) -> str:
    """Return plain card copy without Markdown images or headings."""
    return plain_excerpt(markdown, strip_heading_markers=True)


def _relative_url(from_url: str, target: str) -> str:
    parts = [part for part in from_url.split("/") if part]
    prefix = "../" * len(parts)
    return f"{prefix}{target}" if prefix else target


def _normalize_asset_image_url(raw_url: str, page_url: str, repository: Path) -> str:
    if "://" in raw_url or raw_url.startswith("#"):
        return raw_url

    clean_url = raw_url.strip()
    suffix = ""

    for separator in ("#", "?"):
        if separator in clean_url:
            clean_url, suffix = clean_url.split(separator, 1)
            suffix = f"{separator}{suffix}"
            break

    matched_prefix = next(
        (prefix for prefix in ASSET_IMAGE_PREFIXES if clean_url.startswith(prefix)),
        None,
    )

    if not matched_prefix:
        return raw_url

    image_path = unquote(clean_url[len(matched_prefix):])
    source_path = repository / "docs/assets/images" / image_path

    if not source_path.exists():
        return raw_url

    quoted_path = quote(image_path, safe="/")
    return f"{_relative_url(page_url, f'assets/images/{quoted_path}')}{suffix}"


def _normalize_markdown_images(markdown: str, page_url: str, repository: Path) -> str:
    image_pattern = re.compile(r"(!\[[^\]]*]\()([^)\s]+(?:%20[^)]*)?)(\))")

    def replace(match: re.Match) -> str:
        return (
            f"{match.group(1)}"
            f"{_normalize_asset_image_url(match.group(2), page_url, repository)}"
            f"{match.group(3)}"
        )

    return image_pattern.sub(replace, markdown)


def on_page_markdown(markdown, page, config, files):
    src_path = getattr(page.file, "src_path", "")

    if not any(src_path.startswith(content_dir) for content_dir in CONTENT_DIRS):
        return markdown

    abs_src_path = Path(page.file.abs_src_path)

    if not abs_src_path.exists():
        return markdown

    repository = Path(config.config_file_path).resolve().parent
    markdown = _normalize_markdown_images(markdown, page.url, repository)
    update_date = _git_update_date(abs_src_path.resolve(), repository)
    if update_date:
        page.meta["date_maj"] = update_date
    else:
        page.meta.pop("date_maj", None)

    page.meta["card_excerpt"] = _card_excerpt(markdown)

    return markdown
