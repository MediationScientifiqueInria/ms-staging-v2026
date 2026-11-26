from __future__ import annotations

import sys
import unittest
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts import zensical  # noqa: E402


class ZensicalWrapperTests(unittest.TestCase):
    def test_serializable_converts_nested_dates(self) -> None:
        value = {
            "date": date(2026, 11, 25),
            "items": [datetime(2026, 11, 25, 14, 30)],
        }

        self.assertEqual(
            zensical._serializable(value),
            {"date": "2026-11-25", "items": ["2026-11-25T14:30:00"]},
        )

    def test_generated_config_targets_staged_docs_and_zensical_search(self) -> None:
        config = zensical._generated_configuration({"partners": ["Inria"]})

        self.assertEqual(config["docs_dir"], ".zensical/docs")
        self.assertEqual(config["theme"]["variant"], "classic")
        self.assertNotIn("hooks", config)
        self.assertIn({"search": {"lang": "fr"}}, config["plugins"])
        self.assertEqual(config["extra"]["partners"], ["Inria"])


if __name__ == "__main__":
    unittest.main()
