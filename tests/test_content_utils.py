from __future__ import annotations

import sys
import unittest
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_MODULES = ROOT / "scripts" / "build"
if str(BUILD_MODULES) not in sys.path:
    sys.path.insert(0, str(BUILD_MODULES))

from content_utils import (  # noqa: E402
    as_date,
    as_datetime,
    image_from_content,
    month_label_from_key,
    parse_front_matter,
    plain_excerpt,
    slug,
)


class ContentUtilsTests(unittest.TestCase):
    def test_front_matter_is_parsed_without_losing_body(self) -> None:
        metadata, body = parse_front_matter(
            "---\ntitle: Énergie et climat\ntags:\n  - science\n---\n\n# Introduction\n"
        )

        self.assertEqual(metadata["title"], "Énergie et climat")
        self.assertEqual(metadata["tags"], ["science"])
        self.assertEqual(body, "# Introduction")

    def test_dates_accept_iso_strings(self) -> None:
        self.assertEqual(as_date("2026-11-25T14:30:00"), date(2026, 11, 25))
        self.assertEqual(as_datetime("2026-11-25T14:30:00"), datetime(2026, 11, 25, 14, 30))
        self.assertEqual(month_label_from_key("2026-11"), "Novembre 2026")

    def test_slug_keeps_unicode_letters_and_normalizes_spacing(self) -> None:
        self.assertEqual(slug("Énergie, climat & société"), "énergie-climat-société")

    def test_card_helpers_extract_image_and_plain_text(self) -> None:
        markdown = "![Démonstration](assets/images/demo.png)\n\n## Titre\nDu **contenu** utile."

        self.assertEqual(image_from_content({}, markdown), "assets/images/demo.png")
        self.assertEqual(
            plain_excerpt(markdown, strip_heading_markers=True),
            "Titre Du **contenu** utile.",
        )


if __name__ == "__main__":
    unittest.main()
