from html import escape
from pathlib import Path
import unicodedata

import yaml

SEARCHABLE_FIELDS = (
    "thematiques",
    "domaines",
    "cibles",
    "territoire",
    "support",
    "langue",
    "auteur",
    "auteur_autre",
    "source",
)

THESAURUS_PATH = Path("data/search-thesaurus.yml")
CUSTOM_THESAURUS_PATH = Path("data/search-thesaurus-custom.yml")
thesaurus = {}


def _normalize(value):
    value = unicodedata.normalize("NFKD", str(value).casefold())
    return "".join(character for character in value if not unicodedata.combining(character))


def on_config(config):
    global thesaurus

    root = Path(config.config_file_path).parent
    thesaurus = {}

    path = root / THESAURUS_PATH
    if path.exists():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for term, aliases in (data.get("terms") or {}).items():
            thesaurus[_normalize(term)] = [
                str(alias) for alias in aliases if alias
            ]

    custom_path = root / CUSTOM_THESAURUS_PATH
    if custom_path.exists():
        data = yaml.safe_load(custom_path.read_text(encoding="utf-8")) or {}
        for entry in data.get("entries") or []:
            term = entry.get("term")
            if not term:
                continue

            aliases = [
                str(alias) for alias in entry.get("synonyms") or [] if alias
            ]
            thesaurus.setdefault(_normalize(term), []).extend(aliases)

    return config


def on_page_markdown(markdown, page, **kwargs):
    if not page.file.src_uri.startswith("contenus/ressources/posts/"):
        return markdown

    values = []
    for field in SEARCHABLE_FIELDS:
        value = page.meta.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value if item)
        elif value:
            values.append(str(value))

    if not values:
        return markdown

    expanded_values = []
    seen = set()
    for value in values:
        for term in (value, *thesaurus.get(_normalize(value), [])):
            normalized = _normalize(term)
            if normalized not in seen:
                seen.add(normalized)
                expanded_values.append(term)

    metadata = " ".join(escape(value) for value in expanded_values)
    return f'{markdown}\n\n<div class="search-metadata" aria-hidden="true">{metadata}</div>\n'
