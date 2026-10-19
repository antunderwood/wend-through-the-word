"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
from pathlib import Path

import pytest
from conftest import VERSION, read_json, read_tsv, run_build

SOURCES = Path(os.environ.get("WEND_SOURCES", "sources"))

pytestmark = pytest.mark.skipif(
    not (SOURCES / "verses.json").exists(), reason=f"no downloaded sources in {SOURCES}"
)


@pytest.fixture(scope="module")
def genesis(tmp_path_factory):
    return run_build(tmp_path_factory.mktemp("genesis") / "out", sources=SOURCES, books=["Gen"])


def chapter_files(genesis):
    """The Genesis chapter files, without their Ring 2 sidecars."""
    files = (genesis / "data" / VERSION / "chapter" / "Gen").glob("*.json")
    return [p for p in files if not p.name.endswith(".ring2.json")]


def test_genesis_has_50_chapters_and_1533_verses(genesis):
    chapters = chapter_files(genesis)
    assert len(chapters) == 50
    assert sum(len(read_json(p)["verses"]) for p in chapters) == 1533
    assert read_json(genesis / "data" / "index.json")["counts"] == {"chapters": 50, "verses": 1533}


def test_every_genesis_file_is_below_500_kb(genesis):
    assert all(p.stat().st_size < 500 * 1000 for p in (genesis / "data").rglob("*.json"))


def test_genesis_has_one_file_for_each_entity_in_range(genesis):
    entity = genesis / "data" / VERSION / "entity"
    counts = {d.name: len(list(d.glob("*.json"))) for d in entity.iterdir()}
    assert counts == {"person": 352, "place": 119, "event": 116}


def test_genesis_verses_hold_3348_mentions_all_with_a_verse_key(genesis):
    chapters = chapter_files(genesis)
    mentions = [m for p in chapters for v in read_json(p)["verses"] for m in v["mentions"]]
    assert len(mentions) == 3348
    rows = read_tsv(genesis / "reports" / "verse_mismatches.tsv")
    assert not [r for r in rows if "mention" in r["cause"]]


def test_a_search_for_abraham_returns_abraham_and_the_index_is_below_500_kb_compressed(genesis):
    from test_search_and_credits import compressed_size, search, search_index

    assert search(search_index(genesis), "Abraham") == ["person:abraham_58"]
    assert compressed_size(genesis) < 500 * 1000


def test_creation_in_4004_bc_is_exported_as_minus_4003(genesis):
    event = read_json(genesis / "data" / VERSION / "entity" / "event" / "1.json")
    assert event["event_year"] == -4003


def test_genesis_verses_hold_every_cross_reference_with_an_end_in_genesis(genesis):
    # 13,327 OpenBible rows start in Genesis and 11,300 point to Genesis (decision 52: a range
    # counts at its first verse). A row with both ends in Genesis is in two Verses.
    chapters = chapter_files(genesis)
    verses = [v for p in chapters for v in read_json(p)["verses"]]
    edges = [e for v in verses for n in v["cross_references"] for e in n["edges"]]
    assert len(edges) == 13327 + 11300
    assert not read_tsv(genesis / "reports" / "split_or_trimmed.tsv")
    rows = read_tsv(genesis / "reports" / "verse_mismatches.tsv")
    assert not [r for r in rows if "cross-reference" in r["cause"]]
