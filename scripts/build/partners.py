from __future__ import annotations

from pathlib import Path

import yaml


PARTNERS_FILE = Path("docs/contenus/partenaires.yml")


def _image_path(value: str) -> str:
    value = (value or "").strip()

    if value.startswith("/"):
        value = value[1:]

    if value.startswith("assets/images/"):
        return value

    if value.startswith("docs/assets/images/"):
        return value.removeprefix("docs/")

    return value


def _partners(config) -> list[dict]:
    path = Path(config.config_file_path).parent / PARTNERS_FILE

    if not path.exists():
        return []

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    partners = []

    for item in data.get("partenaires", []):
        name = (item.get("nom") or "").strip()
        image = _image_path(item.get("logo") or "")

        if not name and not image:
            continue

        partners.append({
            "name": name,
            "image": image,
            "url": (item.get("url") or "").strip(),
            "featured": item.get("afficher_accueil", True) is True,
        })

    return partners


def on_env(env, config, files, **kwargs):
    partners = _partners(config)

    env.globals["all_partners"] = partners
    env.globals["home_partners"] = [partner for partner in partners if partner["featured"]]
    return env
