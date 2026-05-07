from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

import yaml


EVENTS_DIR = Path("docs/contenus/evenements")
DEFAULT_COLOR = "#d95e61"


def _front_matter(markdown: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*(.*)$", markdown, re.DOTALL)

    if not match:
        return {}, markdown

    data = yaml.safe_load(match.group(1)) or {}

    return data, match.group(2).strip()


def _iso(value) -> str:
    if value in (None, ""):
        return ""

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    return str(value).split("T")[0]


def _as_list(value) -> list:
    if value in (None, ""):
        return []

    if isinstance(value, list):
        return [item for item in value if item not in (None, "")]

    return [value]


def _color(value) -> str:
    if not isinstance(value, str):
        return DEFAULT_COLOR

    value = value.strip()

    if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        return value

    return DEFAULT_COLOR


def _event_from_file(path: Path) -> dict | None:
    data, body = _front_matter(path.read_text(encoding="utf-8"))
    title = data.get("title") or data.get("titre") or path.stem
    date_debut = _iso(data.get("date_debut") or data.get("date"))

    if not date_debut:
        return None

    description = data.get("description") or ""

    if not description and body:
        description = body

    return {
        "entry_id": path.stem,
        "publie": data.get("publie", True) is not False,
        "titre": title,
        "title": title,
        "description": description,
        "date_debut": date_debut,
        "heure_debut": data.get("heure_debut") or "",
        "date_fin": _iso(data.get("date_fin")),
        "heure_fin": data.get("heure_fin") or "",
        "lieu": data.get("lieu") or "",
        "type": data.get("type") or "Événement",
        "tags": _as_list(data.get("tags")),
        "couleur": _color(data.get("couleur") or data.get("color")),
        "public": data.get("public") or [],
        "territoire": data.get("territoire") or "",
        "lien": data.get("lien") or "",
        "libelle_lien": data.get("libelle_lien") or "En savoir plus",
    }


def _collect_events(config) -> list[dict]:
    events_dir = Path(config.config_file_path).parent / EVENTS_DIR
    events = []

    if not events_dir.exists():
        return events

    for path in sorted(events_dir.glob("*.md")):
        event = _event_from_file(path)

        if event:
            events.append(event)

    return sorted(events, key=lambda event: (event["date_debut"], event["titre"].lower()))


def on_post_build(config, **kwargs):
    output_path = Path(config.site_dir) / "data" / "evenements.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"evenements": _collect_events(config)}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
