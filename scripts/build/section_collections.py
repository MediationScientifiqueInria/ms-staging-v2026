from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent
if str(BUILD_DIR) not in sys.path:
    sys.path.insert(0, str(BUILD_DIR))

from content_utils import (
    DEFAULT_IMAGE,
    as_datetime as _as_datetime,
    date_label as _date_label,
    image_from_content,
    parse_front_matter as _front_matter,
    plain_excerpt as _excerpt,
    slug as _slug,
)


DOCS_DIR = Path("docs/docs/posts")


def _image(data: dict, body: str) -> str:
    return image_from_content(data, body, DEFAULT_IMAGE)


def _collect(config, directory: Path, base_url: str, fallback_type: str) -> list[dict]:
    directory = Path(config.config_file_path).parent / directory

    if not directory.exists():
        return []

    items = []
    for path in directory.glob("*.md"):
        data, body = _front_matter(path.read_text(encoding="utf-8"))
        title = data.get("title") or path.stem
        published = _as_datetime(data.get("date"))

        if published == datetime.min:
            continue

        items.append({
            "title": title,
            "url": data.get("url_externe") or f"{base_url}{_slug(title)}/",
            "external_url": data.get("url_externe") or "",
            "image": _image(data, body),
            "excerpt": _excerpt(body),
            "date": _date_label(published),
            "auteur": data.get("auteur") or "",
            "themes": [item for item in data.get("thematiques", []) if item],
            "tags": [item for item in data.get("tags", []) if item],
            "support": [item for item in data.get("support", []) if item],
            "source": data.get("source") or data.get("auteur") or "",
            "type_label": fallback_type,
        })

    return sorted(items, key=lambda item: item["date"], reverse=True)


def on_env(env, config, files, **kwargs):
    env.globals["all_reference_docs"] = _collect(config, DOCS_DIR, "docs/", "Doc")
    return env
