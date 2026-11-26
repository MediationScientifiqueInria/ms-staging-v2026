#!/usr/bin/env python3
"""Build the site with Zensical while preserving the legacy MkDocs hooks.

Zensical does not execute MkDocs hooks. This wrapper stages the documentation,
materializes their generated pages and template data, then delegates rendering
to the real Zensical CLI. Source content is never modified.
"""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
BUILD_MODULES = ROOT / "scripts" / "build"
STAGE_ROOT = ROOT / ".zensical"
STAGED_DOCS = STAGE_ROOT / "docs"
GENERATED_CONFIG = ROOT / ".zensical.generated.yml"

if str(BUILD_MODULES) not in sys.path:
    sys.path.insert(0, str(BUILD_MODULES))

import calendar_events  # noqa: E402
import content_dates  # noqa: E402
import featured_actualites  # noqa: E402
import optimize_images  # noqa: E402
import partners  # noqa: E402
import search_metadata  # noqa: E402
import section_collections  # noqa: E402
from content_utils import parse_front_matter, slug  # noqa: E402


class EnvLoader(yaml.SafeLoader):
    """Resolve MkDocs' ``!ENV`` YAML tag for the generated configuration."""


def _env(loader: EnvLoader, node: yaml.Node) -> Any:
    values = loader.construct_sequence(node) if isinstance(node, yaml.SequenceNode) else [loader.construct_scalar(node)]
    variable = str(values[0])
    return os.environ.get(variable, values[1] if len(values) > 1 else None)


EnvLoader.add_constructor("!ENV", _env)


def _config() -> SimpleNamespace:
    return SimpleNamespace(
        config_file_path=str(ROOT / "mkdocs.yml"),
        site_dir=str(ROOT / "site"),
    )


def _serializable(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serializable(item) for item in value]
    if isinstance(value, set):
        return [_serializable(item) for item in sorted(value)]
    return value


def _write_markdown(relative_path: str, metadata: dict[str, Any], body: str) -> None:
    path = STAGED_DOCS / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    front_matter = yaml.safe_dump(
        _serializable(metadata),
        allow_unicode=True,
        sort_keys=False,
    ).strip()
    path.write_text(f"---\n{front_matter}\n---\n\n{body.rstrip()}\n", encoding="utf-8")


def _stage_event_pages(config: SimpleNamespace, events: list[dict[str, Any]]) -> None:
    for source in sorted((ROOT / calendar_events.EVENTS_DIR).glob("*.md")):
        metadata, body = parse_front_matter(source.read_text(encoding="utf-8"))
        metadata["hide"] = list(dict.fromkeys([*metadata.get("hide", []), "navigation", "toc"]))
        rendered = calendar_events.event_detail_markdown(metadata, body)
        _write_markdown(source.relative_to(ROOT / "docs").as_posix(), metadata, rendered)

    months = calendar_events.group_events_by_month(events, "contenus/actualites/evenements")
    current = calendar_events.current_month(months, "contenus/actualites/evenements")
    for month, relative_path in [
        *((month, f"contenus/actualites/evenements/{month['key']}.md") for month in months),
        (current, "contenus/actualites/evenements/index.md"),
    ]:
        _write_markdown(
            relative_path,
            {
                "title": month["label"],
                "template": "evenements-mois.html",
                "month_key": month["key"],
                "month_label": month["label"],
                "prev_url": month["prev_url"],
                "next_url": month["next_url"],
                "hide": ["navigation", "toc"],
            },
            f"# {month['label']}",
        )


def _stage_actualites_pages(config: SimpleNamespace, events: list[dict[str, Any]]) -> None:
    actualites = featured_actualites.collect_posts(
        config, featured_actualites.ACTUALITES_DIR, "actualites"
    )
    feed_events = [featured_actualites.event_to_feed_item(event) for event in events if event["publie"]]
    feed = sorted(actualites + feed_events, key=lambda item: item["added"], reverse=True)
    feeds = featured_actualites.paginate(feed, "contenus/actualites/")
    actualites_only = featured_actualites.paginate(actualites, "contenus/actualites/actualites/")

    pages: list[tuple[str, str, int]] = []
    pages.extend(
        (f"contenus/actualites/page/{index + 1}.md", "actualites", index)
        for index in range(1, len(feeds))
    )
    pages.extend(
        (
            f"contenus/actualites/actualites/{'index' if index == 0 else f'page/{index + 1}'}.md",
            "actualites_only",
            index,
        )
        for index in range(len(actualites_only))
    )
    for relative_path, view, index in pages:
        _write_markdown(
            relative_path,
            {
                "title": "Actualités",
                "template": "toutes-actualites.html",
                "actualites_view": view,
                "actualites_page_index": index,
                "hide": ["navigation", "toc"],
            },
            "# Actualités",
        )


def _search_terms(metadata: dict[str, Any]) -> str:
    values: list[str] = []
    for field in search_metadata.SEARCHABLE_FIELDS:
        value = metadata.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value if item)
        elif value:
            values.append(str(value))

    expanded: list[str] = []
    seen: set[str] = set()
    for value in values:
        aliases = search_metadata.thesaurus.get(search_metadata.normalize_term(value), [])
        for term in (value, *aliases):
            normalized = search_metadata.normalize_term(term)
            if normalized not in seen:
                seen.add(normalized)
                expanded.append(term)
    return " ".join(expanded)


def _post_slug_map() -> dict[str, str]:
    """Give duplicate post titles deterministic, collision-free slugs."""
    result: dict[str, str] = {}
    directories = (
        ROOT / "docs/contenus/actualites/posts",
        ROOT / "docs/contenus/ressources/posts",
        ROOT / "docs/docs/posts",
    )
    for directory in directories:
        grouped: dict[str, list[Path]] = {}
        for source in sorted(directory.glob("*.md")):
            metadata, _ = parse_front_matter(source.read_text(encoding="utf-8"))
            title_slug = slug(metadata.get("title") or source.stem)
            grouped.setdefault(title_slug, []).append(source)
        for title_slug, sources in grouped.items():
            used: set[str] = set()
            for index, source in enumerate(sources):
                post_slug = title_slug if index == 0 else slug(source.stem)
                suffix = 2
                candidate = post_slug
                while candidate in used:
                    candidate = f"{post_slug}-{suffix}"
                    suffix += 1
                used.add(candidate)
                result[source.relative_to(ROOT).as_posix()] = candidate
    return result


def _stage_content_metadata(config: SimpleNamespace, post_slugs: dict[str, str]) -> None:
    search_metadata.on_config(config)
    sections = (
        ("contenus/actualites/posts", "contenus/actualites"),
        ("contenus/ressources/posts", "contenus/ressources"),
    )
    for directory, url_base in sections:
        for source in sorted((ROOT / "docs" / directory).glob("*.md")):
            metadata, body = parse_front_matter(source.read_text(encoding="utf-8"))
            title = metadata.get("title") or source.stem
            title_slug = slug(title)
            post_slug = post_slugs[source.relative_to(ROOT).as_posix()]
            if post_slug != title_slug:
                metadata["slug"] = post_slug
            page_url = f"{url_base}/{slug(title)}/"
            body = content_dates.normalize_markdown_images(body, page_url, ROOT)
            body = content_dates.promote_first_markdown_image(body)
            updated = content_dates.content_update_date(source, ROOT)
            if updated:
                metadata["date_maj"] = updated
            else:
                metadata.pop("date_maj", None)
            metadata["card_excerpt"] = content_dates.card_excerpt(body)
            if directory.endswith("ressources/posts"):
                terms = _search_terms(metadata)
                if terms:
                    metadata["search_metadata"] = terms
            _write_markdown(source.relative_to(ROOT / "docs").as_posix(), metadata, body)

    for source in sorted((ROOT / "docs/docs/posts").glob("*.md")):
        metadata, body = parse_front_matter(source.read_text(encoding="utf-8"))
        title_slug = slug(metadata.get("title") or source.stem)
        post_slug = post_slugs[source.relative_to(ROOT).as_posix()]
        if post_slug != title_slug:
            metadata["slug"] = post_slug
        _write_markdown(source.relative_to(ROOT / "docs").as_posix(), metadata, body)


def _template_data(config: SimpleNamespace, post_slugs: dict[str, str]) -> dict[str, Any]:
    environment = SimpleNamespace(globals={})
    calendar_events.on_env(environment, config, [])
    partners.on_env(environment, config, [])
    section_collections.on_env(environment, config, [])
    featured_actualites.on_env(environment, config, [])
    def update_urls(value: Any) -> None:
        if isinstance(value, dict):
            source_path = value.get("source_path")
            if source_path in post_slugs and value.get("url"):
                value["url"] = f"{value['url'].rsplit('/', 2)[0]}/{post_slugs[source_path]}/"
            for item in value.values():
                update_urls(item)
        elif isinstance(value, list):
            for item in value:
                update_urls(item)

    update_urls(environment.globals)
    return _serializable(environment.globals)


def _generated_configuration(template_data: dict[str, Any]) -> dict[str, Any]:
    source = yaml.load((ROOT / "mkdocs.yml").read_text(encoding="utf-8"), Loader=EnvLoader)
    source.pop("hooks", None)
    source["docs_dir"] = ".zensical/docs"
    source.setdefault("theme", {})["variant"] = "classic"
    source.setdefault("extra", {}).update(template_data)
    source["plugins"] = [
        {"search": plugin["material/search"]}
        if isinstance(plugin, dict) and "material/search" in plugin
        else "search"
        if plugin == "material/search"
        else plugin
        for plugin in source.get("plugins", [])
    ]
    return source


def prepare() -> None:
    if STAGE_ROOT.exists():
        shutil.rmtree(STAGE_ROOT)
    shutil.copytree(ROOT / "docs", STAGED_DOCS)

    config = _config()
    post_slugs = _post_slug_map()
    events = calendar_events.collect_events(config)
    _stage_event_pages(config, events)
    _stage_actualites_pages(config, events)
    _stage_content_metadata(config, post_slugs)

    generated = _generated_configuration(_template_data(config, post_slugs))
    GENERATED_CONFIG.write_text(
        yaml.safe_dump(generated, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def _zensical() -> str:
    executable = shutil.which("zensical")
    if not executable:
        raise SystemExit("Zensical est introuvable. Installez les dépendances avec: pip install -r requirements.txt")
    return executable


def _post_build() -> None:
    config = _config()
    calendar_events.on_post_build(config)
    optimize_images.on_post_build(config)


def build(strict: bool) -> int:
    prepare()
    command = [_zensical(), "build", "-c", "-f", str(GENERATED_CONFIG)]
    if strict:
        command.append("--strict")
    result = subprocess.run(command, cwd=ROOT, check=False)
    if result.returncode == 0:
        _post_build()
    return result.returncode


def _snapshot() -> tuple[tuple[str, int, int], ...]:
    roots = [ROOT / "docs", ROOT / "src" / "overrides", ROOT / "data", ROOT / "scripts" / "build"]
    files = [ROOT / "mkdocs.yml"]
    for directory in roots:
        files.extend(path for path in directory.rglob("*") if path.is_file())
    return tuple(
        (path.relative_to(ROOT).as_posix(), path.stat().st_mtime_ns, path.stat().st_size)
        for path in sorted(files)
    )


def serve(address: str, open_browser: bool) -> int:
    command = [_zensical(), "serve", "-f", str(GENERATED_CONFIG), "--dev-addr", address]
    if open_browser:
        command.append("--open")
    process: subprocess.Popen[Any] | None = None
    previous = _snapshot()
    try:
        while True:
            if process is None:
                prepare()
                process = subprocess.Popen(command, cwd=ROOT)
            time.sleep(1)
            current = _snapshot()
            if current != previous:
                previous = current
                process.send_signal(signal.SIGINT)
                process.wait(timeout=10)
                process = None
            elif process.poll() is not None:
                return process.returncode
    except KeyboardInterrupt:
        if process and process.poll() is None:
            process.send_signal(signal.SIGINT)
            process.wait(timeout=10)
        return 130


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    build_parser = subparsers.add_parser("build", help="Construire le site avec Zensical")
    build_parser.add_argument("--strict", action="store_true")
    serve_parser = subparsers.add_parser("serve", help="Servir le site et reconstruire les données à chaque modification")
    serve_parser.add_argument("--dev-addr", default="localhost:8000")
    serve_parser.add_argument("--open", action="store_true")
    args = parser.parse_args()
    if args.command == "build":
        return build(args.strict)
    return serve(args.dev_addr, args.open)


if __name__ == "__main__":
    raise SystemExit(main())
