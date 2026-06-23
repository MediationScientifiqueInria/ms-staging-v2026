from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

import yaml


BILANS_DIR = Path("docs/bilans/posts")
DOCS_DIR = Path("docs/docs/posts")
MONTHS_FR = {
    1: "janvier",
    2: "février",
    3: "mars",
    4: "avril",
    5: "mai",
    6: "juin",
    7: "juillet",
    8: "août",
    9: "septembre",
    10: "octobre",
    11: "novembre",
    12: "décembre",
}


def _front_matter(markdown: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*(.*)$", markdown, re.DOTALL)

    if not match:
        return {}, markdown

    data = yaml.safe_load(match.group(1)) or {}
    return data, match.group(2).strip()


def _as_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    if isinstance(value, str) and value:
        return datetime.fromisoformat(value)

    return datetime.min


def _date_label(value: datetime) -> str:
    if value == datetime.min:
        return ""

    return f"{value.day} {MONTHS_FR[value.month]} {value.year}"


def _slug(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[\s_]+", "-", value).strip("-")
    return value


def _image(data: dict, body: str) -> str:
    if data.get("cover_image"):
        return data["cover_image"]

    match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", body)
    return match.group(1) if match else "assets/images/1007721 (1).png"


def _excerpt(body: str) -> str:
    body = re.sub(r"(?m)^\s*!\[[^\]]*\]\([^\n]*\)\s*$", "", body)
    body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    body = re.sub(r"<[^>]+>", "", body)
    return re.sub(r"\s+", " ", body).strip()


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
    env.globals["all_bilans"] = _collect(config, BILANS_DIR, "bilans/", "Bilan")
    env.globals["all_reference_docs"] = _collect(config, DOCS_DIR, "docs/", "Doc")
    return env
