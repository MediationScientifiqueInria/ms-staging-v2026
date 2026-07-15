from __future__ import annotations

import re
import subprocess
from datetime import date, datetime
from pathlib import Path

import yaml


DEFAULT_IMAGE = "assets/images/1007721 (1).png"
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
MONTHS_SHORT_FR = {
    1: "JAN",
    2: "FÉV",
    3: "MAR",
    4: "AVR",
    5: "MAI",
    6: "JUN",
    7: "JUL",
    8: "AOÛ",
    9: "SEP",
    10: "OCT",
    11: "NOV",
    12: "DÉC",
}


def parse_front_matter(markdown: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*(.*)$", markdown, re.DOTALL)

    if not match:
        return {}, markdown

    data = yaml.safe_load(match.group(1)) or {}
    return data, match.group(2).strip()


def as_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str) and value:
        return datetime.fromisoformat(value.split("T")[0]).date()

    return date.min


def as_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    if isinstance(value, str) and value:
        return datetime.fromisoformat(value).replace(tzinfo=None)

    return datetime.min


def first_datetime(*values) -> datetime:
    for value in values:
        parsed = value if isinstance(value, datetime) else as_datetime(value)
        if parsed != datetime.min:
            return parsed

    return datetime.min


def iso_date(value) -> str:
    if value in (None, ""):
        return ""

    parsed = as_date(value)
    return "" if parsed == date.min else parsed.isoformat()


def date_label(value: date | datetime) -> str:
    if value in (date.min, datetime.min, None):
        return ""

    return f"{value.day} {MONTHS_FR[value.month]} {value.year}"


def short_date(value) -> str:
    parsed = as_date(value)

    if parsed == date.min:
        return ""

    return f"{parsed.day:02d} {MONTHS_SHORT_FR[parsed.month]}"


def month_key(value) -> str:
    parsed = as_date(value)
    return parsed.strftime("%Y-%m") if parsed != date.min else ""


def month_label(value) -> str:
    parsed = as_date(value)

    if parsed == date.min:
        return ""

    return f"{MONTHS_FR[parsed.month].capitalize()} {parsed.year}"


def month_label_from_key(key: str) -> str:
    if not key or "-" not in key:
        return ""

    year, month = key.split("-", 1)
    return f"{MONTHS_FR[int(month)].capitalize()} {year}"


def add_months(key: str, count: int) -> str:
    year, month = (int(part) for part in key.split("-", 1))
    month += count

    while month < 1:
        month += 12
        year -= 1

    while month > 12:
        month -= 12
        year += 1

    return f"{year:04d}-{month:02d}"


def month_range(start_key: str, end_key: str) -> list[str]:
    months = []
    current = start_key

    while current <= end_key:
        months.append(current)
        current = add_months(current, 1)

    return months


def as_list(value) -> list:
    if value in (None, ""):
        return []

    if isinstance(value, list):
        return [item for item in value if item not in (None, "")]

    return [value]


def slug(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[\s_]+", "-", value).strip("-")
    return value


def image_from_content(data: dict, body: str, fallback: str = "") -> str:
    if data.get("cover_image"):
        return str(data["cover_image"]).removeprefix("/")

    match = re.search(r"!\[[^\]]*\]\(((?:[^()]|\([^)]*\))*)\)", body)
    return match.group(1) if match else fallback


def plain_excerpt(body: str, strip_heading_markers: bool = False) -> str:
    body = re.sub(r"(?m)^\s*!\[[^\]]*\]\([^\n]*\)\s*$", "", body)
    body = re.sub(r"!\[[^\]]*]\((?:[^()]|\([^)]*\))*\)", "", body)
    body = re.sub(r"<[^>]+>", "", body)

    if strip_heading_markers:
        body = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", body)

    return re.sub(r"\s+", " ", body).strip()


def git_update_date(path: Path, repository: Path) -> datetime | None:
    """Return the local or committed update date when a file has changed after creation."""
    try:
        status = subprocess.run(
            [
                "git",
                "status",
                "--porcelain",
                "--",
                str(path.relative_to(repository)),
            ],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        status = None

    if status and status.stdout.strip() and not status.stdout.lstrip().startswith("??"):
        return datetime.fromtimestamp(path.stat().st_mtime)

    try:
        result = subprocess.run(
            [
                "git",
                "log",
                "--follow",
                "--format=%aI",
                "--max-count=2",
                "--",
                str(path.relative_to(repository)),
            ],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        return None

    dates = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(dates) < 2:
        return None

    return datetime.fromisoformat(dates[0]).replace(tzinfo=None)
