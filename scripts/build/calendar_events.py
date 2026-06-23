from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

import yaml
from mkdocs.structure.files import File, InclusionLevel


EVENTS_DIR = Path("docs/contenus/evenements")
DEFAULT_COLOR = "#d95e61"
MONTHS_SHORT_FR = {
    "01": "JAN",
    "02": "FÉV",
    "03": "MAR",
    "04": "AVR",
    "05": "MAI",
    "06": "JUN",
    "07": "JUL",
    "08": "AOÛ",
    "09": "SEP",
    "10": "OCT",
    "11": "NOV",
    "12": "DÉC",
}
MONTHS_FR = {
    "01": "Janvier",
    "02": "Février",
    "03": "Mars",
    "04": "Avril",
    "05": "Mai",
    "06": "Juin",
    "07": "Juillet",
    "08": "Août",
    "09": "Septembre",
    "10": "Octobre",
    "11": "Novembre",
    "12": "Décembre",
}


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


def _short_date(value) -> str:
    iso = _iso(value)

    if not iso:
        return ""

    _, month, day = iso.split("-")
    return f"{day} {MONTHS_SHORT_FR.get(month, month)}"


def _month_label(value) -> str:
    iso = _iso(value)

    if not iso:
        return ""

    year, month, _ = iso.split("-")
    return f"{MONTHS_FR.get(month, month)} {year}"


def _month_key(value) -> str:
    iso = _iso(value)
    return iso[:7] if iso else ""


def _month_label_from_key(key: str) -> str:
    if not key or "-" not in key:
        return ""

    year, month = key.split("-", 1)
    return f"{MONTHS_FR.get(month, month)} {year}"


def _add_months(key: str, count: int) -> str:
    year, month = (int(part) for part in key.split("-", 1))
    month += count

    while month < 1:
        month += 12
        year -= 1

    while month > 12:
        month -= 12
        year += 1

    return f"{year:04d}-{month:02d}"


def _month_range(start_key: str, end_key: str) -> list[str]:
    months = []
    current = start_key

    while current <= end_key:
        months.append(current)
        current = _add_months(current, 1)

    return months


def _as_list(value) -> list:
    if value in (None, ""):
        return []

    if isinstance(value, list):
        return [item for item in value if item not in (None, "")]

    return [value]


def _time(value) -> str:
    if value in (None, ""):
        return ""

    if isinstance(value, int):
        if 0 <= value < 24 * 60:
            return f"{value // 60:02d}:{value % 60:02d}"

        return str(value)

    text = str(value).strip()
    match = re.fullmatch(r"(\d{1,2}):([0-5]\d)", text)

    if not match:
        return text

    hour = int(match.group(1))
    minute = int(match.group(2))

    if hour > 23:
        return text

    return f"{hour:02d}:{minute:02d}"


def _color(value) -> str:
    if not isinstance(value, str):
        return DEFAULT_COLOR

    value = value.strip()

    if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        return value

    return DEFAULT_COLOR


def _image(data: dict, body: str) -> str:
    if data.get("cover_image"):
        return data["cover_image"]

    match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", body)
    return match.group(1) if match else ""


def _excerpt(body: str) -> str:
    body = re.sub(r"(?m)^\s*!\[[^\]]*\]\([^\n]*\)\s*$", "", body)
    body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"#{1,6}\s*", "", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body


def _event_from_file(path: Path) -> dict | None:
    data, body = _front_matter(path.read_text(encoding="utf-8"))
    title = data.get("title") or data.get("titre") or path.stem
    date_debut = _iso(data.get("date_debut") or data.get("date"))
    is_all_day = data.get("toute_la_journee", False) is True

    if not date_debut:
        return None

    return {
        "entry_id": path.stem,
        "publie": data.get("publie", True) is not False,
        "featured": data.get("featured", False) is True,
        "titre": title,
        "title": title,
        "url": f"contenus/evenements/{path.stem}/",
        "image": _image(data, body),
        "description": _excerpt(body),
        "date_publication": _iso(data.get("date_publication")),
        "date_ajout": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
        "date_debut": date_debut,
        "date_debut_label": _short_date(data.get("date_debut") or data.get("date")),
        "month_key": _month_key(data.get("date_debut") or data.get("date")),
        "month_label": _month_label(data.get("date_debut") or data.get("date")),
        "toute_la_journee": is_all_day,
        "heure_debut": "" if is_all_day else _time(data.get("heure_debut")),
        "date_fin": _iso(data.get("date_fin")),
        "date_fin_label": _short_date(data.get("date_fin")),
        "heure_fin": "" if is_all_day else _time(data.get("heure_fin")),
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


def _group_events_by_month(events: list[dict], base_url: str = "contenus/evenements") -> list[dict]:
    current_key = date.today().strftime("%Y-%m")
    event_months = sorted({event["month_key"] for event in events if event["month_key"]})
    start_key = min(event_months + [_add_months(current_key, -12)])
    end_key = max(event_months + [_add_months(current_key, 12)])
    counts = {key: [] for key in _month_range(start_key, end_key)}

    for event in events:
        if not event["month_key"]:
            continue

        counts.setdefault(event["month_key"], []).append(event)

    months = []
    keys = list(counts)

    for index, key in enumerate(keys):
        months.append({
            "key": key,
            "label": _month_label_from_key(key),
            "url": f"{base_url}/{key}/",
            "events": counts[key],
            "prev_url": f"{base_url}/{keys[index - 1]}/" if index > 0 else "",
            "next_url": f"{base_url}/{keys[index + 1]}/" if index < len(keys) - 1 else "",
        })

    return months


def _current_month(months: list[dict], base_url: str = "contenus/evenements") -> dict:
    current_key = date.today().strftime("%Y-%m")

    for month in months:
        if month["key"] == current_key:
            return {**month, "url": f"{base_url}/"}

    return {
        "key": current_key,
        "label": _month_label_from_key(current_key),
        "url": f"{base_url}/",
        "events": [],
        "prev_url": "",
        "next_url": "",
    }


def _event_detail_markdown(meta: dict, markdown: str) -> str:
    title = meta.get("title") or meta.get("titre") or "Événement"
    body = markdown.strip()
    details = [
        ("Date de début", _iso(meta.get("date_debut") or meta.get("date"))),
        ("Horaire", "Toute la journée" if meta.get("toute_la_journee") is True else ""),
        ("Heure de début", "" if meta.get("toute_la_journee") is True else _time(meta.get("heure_debut"))),
        ("Date de fin", _iso(meta.get("date_fin"))),
        ("Heure de fin", "" if meta.get("toute_la_journee") is True else _time(meta.get("heure_fin"))),
        ("Lieu", meta.get("lieu") or ""),
        ("Type", meta.get("type") or ""),
        ("Public", ", ".join(_as_list(meta.get("public")))),
        ("Territoire", meta.get("territoire") or ""),
    ]

    parts = [f"# {title}"]

    visible_details = [(label, value) for label, value in details if value]

    if visible_details:
        parts.append("## Informations pratiques")
        parts.extend(f"- **{label}** : {value}" for label, value in visible_details)

    if meta.get("lien"):
        label = meta.get("libelle_lien") or "En savoir plus"
        parts.append(f"[{label}]({meta['lien']})")

    if body:
        parts.append(body)

    return "\n\n".join(parts)


def on_page_markdown(markdown, page, config, files):
    if not page.file.src_uri.startswith("contenus/evenements/"):
        return markdown

    if page.meta.get("template") == "evenements-mois.html":
        return markdown

    page.meta["hide"] = list(set(page.meta.get("hide", []) + ["navigation", "toc"]))

    return _event_detail_markdown(page.meta, markdown)


def _generated_month_page(config, month: dict, path: str) -> File:
    return File.generated(
        config,
        path,
        content=(
            "---\n"
            f"title: {month['label']}\n"
            "template: evenements-mois.html\n"
            f"month_key: {month['key']}\n"
            f"month_label: {month['label']}\n"
            f"prev_url: {month['prev_url']}\n"
            f"next_url: {month['next_url']}\n"
            "hide:\n"
            "  - navigation\n"
            "  - toc\n"
            "---\n\n"
            f"# {month['label']}\n"
        ),
        inclusion=InclusionLevel.NOT_IN_NAV,
    )


def on_files(files, config, **kwargs):
    events = _collect_events(config)

    for month in _group_events_by_month(events, "contenus/actualites/evenements"):
        files.append(_generated_month_page(config, month, f"contenus/actualites/evenements/{month['key']}.md"))

    return files


def on_env(env, config, files, **kwargs):
    events = _collect_events(config)
    actualites_months = _group_events_by_month(events, "contenus/actualites/evenements")
    today = date.today().isoformat()
    upcoming_events = [
        event for event in events if event["publie"] and event["date_debut"] >= today
    ]
    published_events = [event for event in events if event["publie"]]

    env.globals["all_evenements"] = events
    env.globals["upcoming_evenements"] = upcoming_events
    env.globals["home_evenements"] = upcoming_events or list(reversed(published_events))
    env.globals["actualites_evenements_by_month"] = actualites_months
    env.globals["current_actualites_evenements_month"] = _current_month(actualites_months, "contenus/actualites/evenements")
    env.globals["current_actualites_evenements_url"] = f"contenus/actualites/evenements/{env.globals['current_actualites_evenements_month']['key']}/"
    return env


def on_post_build(config, **kwargs):
    output_path = Path(config.site_dir) / "data" / "evenements.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"evenements": _collect_events(config)}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
