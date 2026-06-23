from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

import yaml
from mkdocs.structure.files import File, InclusionLevel


ACTUALITES_DIR = Path("docs/contenus/actualites/posts")
RESSOURCES_DIR = Path("docs/contenus/ressources/posts")
EVENTS_DIR = Path("docs/contenus/evenements")
A_LA_UNE_FILE = Path("docs/contenus/a-la-une.yml")
ACTUALITES_PER_PAGE = 12
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


def _as_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    if isinstance(value, str) and value:
        return datetime.fromisoformat(value)

    return datetime.min


def _content_added_datetime(data: dict) -> datetime:
    return _first_datetime(data.get("date_publication"), data.get("date"))


def _first_datetime(*values) -> datetime:
    for value in values:
        parsed = value if isinstance(value, datetime) else _as_datetime(value)
        if parsed != datetime.min:
            return parsed

    return datetime.min


def _date_label(value: date) -> str:
    if value in (date.min, datetime.min):
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
    body = re.sub(r"(?m)^\s*!\[[^\]]*\]\([^\n]*\)\s*$", "", body)
    body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body


def _post_from_file(path: Path, section: str) -> dict | None:
    data, body = _front_matter(path.read_text(encoding="utf-8"))
    title = data.get("title") or path.stem
    published = _as_datetime(data.get("date"))
    added = _content_added_datetime(data)
    author = data.get("auteur_autre") or data.get("auteur") or ""

    if published == datetime.min:
        return None

    return {
        "title": title,
        "url": f"contenus/{section}/{_slug(title)}/",
        "image": _image(data, body) or "assets/images/Inria-mediation.png",
        "excerpt": _excerpt(data, body),
        "date": _date_label(published),
        "auteur": author,
        "themes": [item for item in data.get("thematiques", []) if item],
        "tags": [item for item in data.get("tags", []) if item],
        "support": [item for item in data.get("support", []) if item],
        "cibles": [item for item in data.get("cibles", []) if item],
        "external_url": data.get("url_externe") or "",
        "source": data.get("source") or author,
        "featured": data.get("featured", False) is True,
        "content_type": section,
        "type_label": "Article" if section == "actualites" else "Ressource",
        "published": published,
        "added": added,
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


def _feed_event_from_file(path: Path) -> dict | None:
    data, body = _front_matter(path.read_text(encoding="utf-8"))
    event_date = _as_date(data.get("date_debut") or data.get("date"))
    published = _first_datetime(data.get("date_publication"), event_date)
    added = _as_datetime(data.get("date_publication"))
    title = data.get("title") or data.get("titre") or path.stem

    if event_date == date.min or data.get("publie", True) is False:
        return None

    return {
        "title": title,
        "url": f"contenus/evenements/{path.stem}/",
        "image": _image(data, body) or "assets/images/Inria-mediation.png",
        "excerpt": _excerpt({}, body),
        "date": _date_label(published),
        "auteur": data.get("lieu") or "",
        "themes": [data.get("type") or "Événement"],
        "tags": [item for item in data.get("tags", []) if item],
        "featured": data.get("featured", False) is True,
        "content_type": "evenements",
        "type_label": "Événement",
        "published": published,
        "added": added,
    }


def _collect_feed_events(config) -> list[dict]:
    events_dir = Path(config.config_file_path).parent / EVENTS_DIR

    if not events_dir.exists():
        return []

    events = []
    for path in events_dir.glob("*.md"):
        event = _feed_event_from_file(path)
        if event:
            events.append(event)

    return sorted(events, key=lambda event: event["published"], reverse=True)


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
        "published": _as_datetime(event.get("date_debut")),
        "added": _as_datetime(event.get("date_publication")),
    }


def _event_to_feed_item(event: dict) -> dict:
    return {
        "title": event["title"],
        "url": event["url"],
        "image": event.get("image") or "assets/images/Inria-mediation.png",
        "excerpt": event.get("description") or "",
        "date": event.get("date_debut_label") or event.get("month_label") or "",
        "auteur": event.get("lieu") or "",
        "themes": [event.get("type") or "Événement"],
        "tags": [item for item in event.get("tags", []) if item],
        "featured": event.get("featured", False) is True,
        "content_type": "evenements",
        "type_label": "Événement",
        "published": _first_datetime(event.get("date_publication"), event.get("date_ajout"), event.get("date_debut")),
        "added": _as_datetime(event.get("date_publication")),
    }


def _page_url(base_url: str, index: int) -> str:
    return base_url if index == 0 else f"{base_url}page/{index + 1}/"


def _paginate(items: list[dict], base_url: str) -> list[dict]:
    chunks = [
        items[index:index + ACTUALITES_PER_PAGE]
        for index in range(0, len(items), ACTUALITES_PER_PAGE)
    ] or [[]]
    total = len(chunks)
    pages = []

    for index, chunk in enumerate(chunks):
        pagination = None

        if total > 1:
            pagination = {
                "current": index + 1,
                "total": total,
                "prev_url": _page_url(base_url, index - 1) if index > 0 else "",
                "next_url": _page_url(base_url, index + 1) if index < total - 1 else "",
                "pages": [
                    {"number": page_index + 1, "url": _page_url(base_url, page_index)}
                    for page_index in range(total)
                ],
            }

        pages.append({
            "items": chunk,
            "pagination": pagination,
        })

    return pages


def _unique_by_url(items: list[dict]) -> list[dict]:
    seen = set()
    unique = []

    for item in items:
        url = item.get("url")

        if url in seen:
            continue

        seen.add(url)
        unique.append(item)

    return unique


def _generated_actualites_page(config, path: str, view: str, index: int) -> File:
    title = "Articles" if view == "articles" else "Actualités"

    return File.generated(
        config,
        path,
        content=(
            "---\n"
            f"title: {title}\n"
            "template: toutes-actualites.html\n"
            f"actualites_view: {view}\n"
            f"actualites_page_index: {index}\n"
            "hide:\n"
            "  - navigation\n"
            "  - toc\n"
            "---\n\n"
            "# Actualités\n"
        ),
        inclusion=InclusionLevel.NOT_IN_NAV,
    )


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


def on_files(files, config, **kwargs):
    actualites = _collect_posts(config, ACTUALITES_DIR, "actualites")
    events = _collect_feed_events(config)
    feed = sorted(actualites + events, key=lambda item: item["added"], reverse=True)
    feed_pages = _paginate(feed, "contenus/actualites/")
    article_pages = _paginate(actualites, "contenus/actualites/articles/")

    for index in range(1, len(feed_pages)):
        files.append(_generated_actualites_page(config, f"contenus/actualites/page/{index + 1}.md", "actualites", index))

    for index in range(0, len(article_pages)):
        files.append(_generated_actualites_page(config, f"contenus/actualites/articles/{'index' if index == 0 else f'page/{index + 1}'}.md", "articles", index))

    return files


def on_env(env, config, files, **kwargs):
    actualites = _collect_posts(config, ACTUALITES_DIR, "actualites")
    ressources = _collect_posts(config, RESSOURCES_DIR, "ressources")
    featured_events = []
    feed_events = []
    all_events = env.globals.get("all_evenements", [])

    for event in all_events:
        if not event.get("publie"):
            continue

        feed_events.append(_event_to_feed_item(event))

        if event.get("featured"):
            featured_events.append(_event_to_featured_item(event))

    selected_featured = [post for post in actualites if post["featured"]] + featured_events
    selected_featured = sorted(selected_featured, key=lambda item: item["published"], reverse=True)
    configured_featured = _configured_featured(config, actualites, all_events)
    home_featured_items = configured_featured or selected_featured[:4] or actualites[:4]
    home_featured_urls = {item["url"] for item in home_featured_items}
    latest_actualites = [
        post for post in actualites
        if post["url"] not in home_featured_urls
    ]
    actualites_feed = sorted(actualites + feed_events, key=lambda item: item["added"], reverse=True)

    env.globals["featured_actualites"] = latest_actualites[:4]
    env.globals["home_featured_items"] = home_featured_items
    env.globals["all_actualites"] = actualites
    env.globals["actualites_feed_pages"] = _paginate(actualites_feed, "contenus/actualites/")
    env.globals["actualites_article_pages"] = _paginate(actualites, "contenus/actualites/articles/")
    env.globals["featured_resources"] = ressources[:3]
    env.globals["all_resources"] = ressources
    return env
