from __future__ import annotations

from datetime import datetime
from pathlib import Path


CONTENT_DIRS = (
    "contenus/actualites/posts/",
    "contenus/ressources/posts/",
)


def on_page_markdown(markdown, page, config, files):
    src_path = getattr(page.file, "src_path", "")

    if not any(src_path.startswith(content_dir) for content_dir in CONTENT_DIRS):
        return markdown

    abs_src_path = Path(page.file.abs_src_path)

    if not abs_src_path.exists():
        return markdown

    page.meta["date_maj"] = datetime.fromtimestamp(abs_src_path.stat().st_mtime).date()

    return markdown
