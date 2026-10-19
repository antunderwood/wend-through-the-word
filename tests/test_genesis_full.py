"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
from pathlib import Path

import pytest
from conftest import VERSION, read_json, run_build

SOURCES = Path(os.environ.get("WEND_SOURCES", "sources"))

pytestmark = pytest.mark.skipif(
    not (SOURCES / "verses.json").exists(), reason=f"no downloaded sources in {SOURCES}"
)


@pytest.fixture(scope="module")
def genesis(tmp_path_factory):
    return run_build(tmp_path_factory.mktemp("genesis") / "out", sources=SOURCES, books=["Gen"])


def test_genesis_has_50_chapters_and_1533_verses(genesis):
    chapters = list((genesis / "data" / VERSION / "chapter" / "Gen").glob("*.json"))
    assert len(chapters) == 50
    assert sum(len(read_json(p)["verses"]) for p in chapters) == 1533
    assert read_json(genesis / "data" / "index.json")["counts"] == {"chapters": 50, "verses": 1533}


def test_every_genesis_file_is_below_500_kb(genesis):
    assert all(p.stat().st_size < 500 * 1000 for p in (genesis / "data").rglob("*.json"))
