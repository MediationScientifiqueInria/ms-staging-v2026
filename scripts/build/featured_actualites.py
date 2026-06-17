from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

import yaml


ACTUALITES_DIR = Path("docs/contenus/actualites/posts")
RESSOURCES_DIR = Path("docs/contenus/ressources/posts")
A_LA_UNE_FILE = Path("docs/contenus/a-la-une.yml")
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


def _as_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str) and value:
        return datetime.fromisoformat(value.split("T")[0]).date()

    return date.min


def _date_label(value: date) -> str:
    if value == date.min:
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
    return match.group(1) if match else ""


def _excerpt(data: dict, body: str) -> str:
    description = data.get("description")
    if description not in (None, "", "None"):
        return str(description).strip()

    body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body


def _post_from_file(path: Path, section: str) -> dict | None:
    data, body = _front_matter(path.read_text(encoding="utf-8"))
    title = data.get("title") or path.stem
    published = _as_date(data.get("date"))

    if published == date.min:
        return None

    return {
        "title": title,
        "url": f"contenus/{section}/{_slug(title)}/",
        "image": _image(data, body) or "assets/images/Inria-mediation.png",
        "excerpt": _excerpt(data, body),
        "date": _date_label(published),
        "auteur": data.get("auteur") or "",
        "themes": [item for item in data.get("thematiques", []) if item],
        "tags": [item for item in data.get("tags", []) if item],
        "support": [item for item in data.get("support", []) if item],
        "cibles": [item for item in data.get("cibles", []) if item],
        "external_url": data.get("url_externe") or "",
        "source": data.get("source") or data.get("auteur") or "",
        "featured": data.get("featured", False) is True,
        "content_type": section,
        "type_label": "Actualité" if section == "actualites" else "Ressource",
        "published": published,
    }


def _collect_posts(config, posts_dir: Path, section: str) -> list[dict]:
    posts_dir = Path(config.config_file_path).parent / posts_dir

    if not posts_dir.exists():
        return []

    posts = []
    for path in posts_dir.glob("*.md"):
        post = _post_from_file(path, section)
        if post:
            posts.append(post)

    return sorted(posts, key=lambda post: post["published"], reverse=True)


def _event_to_featured_item(event: dict) -> dict:
    return {
        "title": event["title"],
        "url": event["url"],
        "image": event.get("image") or "assets/images/Inria-mediation.png",
        "excerpt": event.get("description") or "",
        "date": event.get("month_label") or event.get("date_debut_label") or "",
        "auteur": event.get("lieu") or "",
        "themes": [event.get("type") or "Événement"],
        "featured": True,
        "content_type": "evenements",
        "type_label": "Événement",
        "published": _as_date(event.get("date_debut")),
    }


def _configured_featured(config, actualites: list[dict], events: list[dict]) -> list[dict]:
    path = Path(config.config_file_path).parent / A_LA_UNE_FILE

    if not path.exists():
        return []

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    items = data.get("items") or []
    actualites_by_title = {post["title"]: post for post in actualites}
    events_by_title = {
        event["title"]: event
        for event in events
        if event.get("publie")
    }
    featured = []

    for item in items:
        if len(featured) >= 4:
            break

        if item.get("type") == "actualite" and item.get("actualite") in actualites_by_title:
            featured.append(actualites_by_title[item["actualite"]])

        if item.get("type") == "evenement" and item.get("evenement") in events_by_title:
            featured.append(_event_to_featured_item(events_by_title[item["evenement"]]))

    return featured


def on_env(env, config, files, **kwargs):
    actualites = _collect_posts(config, ACTUALITES_DIR, "actualites")
    ressources = _collect_posts(config, RESSOURCES_DIR, "ressources")
    featured_events = []
    all_events = env.globals.get("all_evenements", [])

    for event in all_events:
        if not event.get("featured") or not event.get("publie"):
            continue

        featured_events.append(_event_to_featured_item(event))

    selected_featured = [post for post in actualites if post["featured"]] + featured_events
    selected_featured = sorted(selected_featured, key=lambda item: item["published"], reverse=True)
    configured_featured = _configured_featured(config, actualites, all_events)

    env.globals["featured_actualites"] = actualites[:4]
    env.globals["home_featured_items"] = configured_featured or selected_featured[:4] or actualites[:4]
    env.globals["all_actualites"] = actualites
    env.globals["featured_resources"] = ressources[:3]
    env.globals["all_resources"] = ressources
    return env
