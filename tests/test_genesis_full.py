"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
from collections import Counter
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


def test_genesis_has_50_chapters_and_1533_verses(genesis):
    chapters = list((genesis / "data" / VERSION / "chapter" / "Gen").glob("*.json"))
    assert len(chapters) == 50
    assert sum(len(read_json(p)["verses"]) for p in chapters) == 1533
    assert read_json(genesis / "data" / "index.json")["counts"] == {"chapters": 50, "verses": 1533}


def test_every_genesis_file_is_below_500_kb(genesis):
    assert all(p.stat().st_size < 500 * 1000 for p in (genesis / "data").rglob("*.json"))


def test_genesis_has_one_file_for_each_entity_in_range_and_each_stub(genesis):
    entity = genesis / "data" / VERSION / "entity"
    files = [read_json(p) for p in entity.rglob("*.json")]
    in_range = Counter(e["type"] for e in files if e["verses"])
    assert in_range == {"person": 352, "place": 119, "event": 116}
    # Stubs: Entities with no Genesis verse that an explicit edge links to Genesis (decision 51).
    stubs = Counter(e["type"] for e in files if not e["verses"])
    assert stubs == {"person": 101, "place": 2, "event": 152, "group": 14}


def test_genesis_half_siblings_are_the_242_links_theographic_gives(genesis):
    entity = genesis / "data" / VERSION / "entity"
    files = [read_json(p) for p in entity.rglob("*.json")]
    half = [x for e in files for n in e["neighbours"] for x in n["edges"]]
    assert sum(x["edge"] == "HALF_SIBLING_OF" for x in half) == 242
    isaac = read_json(entity / "person" / "isaac_616.json")
    assert sorted(
        n["id"] for n in isaac["neighbours"] if n["edges"][0]["edge"] == "HALF_SIBLING_OF"
    ) == [
        "person:ishbak_620",
        "person:ishmael_630",
        "person:jokshan_1685",
        "person:medan_1978",
        "person:midian_2075",
        "person:shuah_2727",
        "person:zimran_3086",
    ]


def test_genesis_drops_no_edge_and_lists_23_uncurated_partner_pairs(genesis):
    assert read_tsv(genesis / "reports" / "dropped_edges.tsv") == []
    assert len(read_tsv(genesis / "reports" / "uncurated_partners.tsv")) == 23


def test_genesis_verses_hold_3348_mentions_all_with_a_verse_key(genesis):
    chapters = (genesis / "data" / VERSION / "chapter" / "Gen").glob("*.json")
    mentions = [m for p in chapters for v in read_json(p)["verses"] for m in v["mentions"]]
    assert len(mentions) == 3348
    rows = read_tsv(genesis / "reports" / "verse_mismatches.tsv")
    assert not [r for r in rows if "mention" in r["cause"]]


def test_creation_in_4004_bc_is_exported_as_minus_4003(genesis):
    event = read_json(genesis / "data" / VERSION / "entity" / "event" / "1.json")
    assert event["event_year"] == -4003
