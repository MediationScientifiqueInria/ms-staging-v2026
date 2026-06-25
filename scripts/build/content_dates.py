from __future__ import annotations

import re
import subprocess
from datetime import datetime
from pathlib import Path


CONTENT_DIRS = (
    "contenus/actualites/posts/",
    "contenus/ressources/posts/",
)


def _card_excerpt(markdown: str) -> str:
    """Return plain card copy without Markdown images or headings."""
    excerpt = re.sub(r"!\[[^\]]*]\((?:[^()]|\([^)]*\))*\)", "", markdown)
    excerpt = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", excerpt)
    excerpt = re.sub(r"<[^>]+>", "", excerpt)
    return re.sub(r"\s+", " ", excerpt).strip()


def _git_update_date(path: Path, repository: Path) -> datetime | None:
    """Return the latest commit date only when the file has been committed twice."""
    try:
        result = subprocess.run(
            [
                "git",
                "log",
                "--follow",
                "--format=%aI",
                "--max-count=2",
                "--",
                str(path.relative_to(repository)),
            ],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        return None

    dates = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(dates) < 2:
        return None

    return datetime.fromisoformat(dates[0])


def on_page_markdown(markdown, page, config, files):
    src_path = getattr(page.file, "src_path", "")

    if not any(src_path.startswith(content_dir) for content_dir in CONTENT_DIRS):
        return markdown

    abs_src_path = Path(page.file.abs_src_path)

    if not abs_src_path.exists():
        return markdown

    repository = Path(config.config_file_path).resolve().parent
    update_date = _git_update_date(abs_src_path.resolve(), repository)
    if update_date:
        page.meta["date_maj"] = update_date
    else:
        page.meta.pop("date_maj", None)

    page.meta["card_excerpt"] = _card_excerpt(markdown)

    return markdown
