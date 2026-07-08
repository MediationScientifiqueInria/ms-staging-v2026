from __future__ import annotations

import re
import subprocess
from datetime import date, datetime
from pathlib import Path


CONTENT_DIRS = (
    Path("docs/contenus/actualites/posts"),
    Path("docs/contenus/ressources/posts"),
    Path("docs/docs/posts"),
)
DATE_FIELDS = {
    "date",
    "date_publication",
    "date_sujet",
    "date_debut",
    "date_fin",
}


def _fallback_date(path: Path) -> date:
    try:
        result = subprocess.run(
            ["git", "log", "--follow", "--format=%aI", "--max-count=1", "--", path.as_posix()],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return date.today()

    value = result.stdout.strip()
    if not value:
        return date.today()

    return datetime.fromisoformat(value).date()


def _normalize_date_value(path: Path, value: str) -> str:
    value = value.strip()

    if value in {"", "''", '""', "null", "Null", "NULL", "~", "{{now}}", '"{{now}}"', "'{{now}}'"}:
        return _fallback_date(path).isoformat()

    value = value.strip("'\"")

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return value


def _normalize_front_matter(path: Path) -> bool:
    markdown = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---\s*(.*)$", markdown, re.DOTALL)

    if not match:
        return False

    changed = False
    lines = []

    for line in match.group(1).splitlines():
        field_match = re.match(r"^(\s*)([A-Za-z_][\w-]*)(\s*:\s*)(.*)$", line)

        if not field_match or field_match.group(2) not in DATE_FIELDS:
            lines.append(line)
            continue

        normalized = _normalize_date_value(path, field_match.group(4))
        new_line = f"{field_match.group(1)}{field_match.group(2)}{field_match.group(3)}{normalized}"

        if new_line != line:
            changed = True

        lines.append(new_line)

    if not changed:
        return False

    front_matter = "\n".join(lines)
    path.write_text(f"---\n{front_matter}\n---\n{match.group(2)}", encoding="utf-8")
    return True


def main() -> None:
    changed_paths = []

    for directory in CONTENT_DIRS:
        if not directory.exists():
            continue

        for path in sorted(directory.glob("*.md")):
            if _normalize_front_matter(path):
                changed_paths.append(path.as_posix())

    if changed_paths:
        print("Dates normalisées avant build MkDocs:")
        for path in changed_paths:
            print(f"- {path}")
    else:
        print("Aucune date de contenu à normaliser.")


if __name__ == "__main__":
    main()
