"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
import re
from collections import Counter
from pathlib import Path

import pytest
from conftest import FIXTURES, VERSION, read_json, read_tsv, run_build
from test_coordinates import openstreetmap_points, shipped_points
from test_tipnr import TIPNR

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
    # Only People (family edges) and People Groups (MEMBER_OF) ship as stubs.
    assert stubs == {"person": 84, "group": 14}


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


def test_genesis_drops_only_edges_to_places_and_events_outside_the_range(genesis):
    rows = read_tsv(genesis / "reports" / "dropped_edges.tsv")
    assert Counter(r["field"] for r in rows) == {
        "participants": 135,
        "locations": 44,
        "birthPlace": 16,
        "deathPlace": 1,
    }
    assert all("outside the book range" in r["cause"] for r in rows)


def test_genesis_lists_23_uncurated_partner_pairs(genesis):
    assert len(read_tsv(genesis / "reports" / "uncurated_partners.tsv")) == 23


def test_genesis_verses_hold_3348_mentions_all_with_a_verse_key(genesis):
    chapters = (genesis / "data" / VERSION / "chapter" / "Gen").glob("*.json")
    mentions = [m for p in chapters for v in read_json(p)["verses"] for m in v["mentions"]]
    assert len(mentions) == 3348
    rows = read_tsv(genesis / "reports" / "verse_mismatches.tsv")
    assert not [r for r in rows if "mention" in r["cause"]]


def test_a_search_for_abraham_returns_abraham_and_the_index_is_below_500_kb_compressed(genesis):
    from test_search_and_credits import compressed_size, search, search_index

    assert search(search_index(genesis), "Abraham") == ["person:abraham_58"]
    assert compressed_size(genesis) < 500 * 1000


def test_a_search_for_luz_finds_bethel(genesis):
    from test_search_and_credits import search, search_index

    # Luz is its own Place (decision 7) and an other name of Bethel (decision 65).
    assert search(search_index(genesis), "Luz") == ["place:bethel_202", "place:luz_737"]


def test_creation_in_4004_bc_is_exported_as_minus_4003(genesis):
    event = read_json(genesis / "data" / VERSION / "entity" / "event" / "1.json")
    assert event["event_year"] == -4003


def test_every_genesis_place_has_a_cc_by_point_or_is_in_the_no_coordinate_report(genesis):
    shipped = shipped_points(genesis)
    assert not {(p["lat"], p["lon"]) for p in shipped} & openstreetmap_points(SOURCES)
    report = {r["place"]: r["cause"] for r in read_tsv(genesis / "reports" / "no_coordinate.tsv")}
    assert (len(shipped), len(report)) == (64, 55)  # 47 of the 55 are on OSM geometry (dec. 57)
    assert report["place:galeed_432"] == "no OpenBible link"
    assert report["place:eden_354"] == "OpenBible gives no point"
    assert report["place:euphrates_421"] == "OpenBible point dropped: OpenStreetMap geometry"


def test_genesis_tipnr_check_reports_46_disagreements(genesis):
    rows = read_tsv(genesis / "reports" / "tipnr_disagreements.tsv")
    assert len(rows) == 46
    # Theographic has three Anahs where TIPNR has one; Theographic decides (decision 7).
    assert {r["person"] for r in rows if r["tipnr_person"].startswith("Anah@")} == {
        "person:anah_247",
        "person:anah_248",
        "person:anah_249",
    }


def test_no_genesis_file_holds_a_tipnr_record_key(genesis):
    key = re.compile(r"\w@[1-3A-Z][a-z]{2}\.\d+\.\d+")  # "Abraham@Gen.11.26-1Pe"
    assert not [p for p in (genesis / "data").rglob("*.json") if key.search(p.read_text())]


def test_the_tipnr_fixture_holds_no_line_of_the_real_file():
    real = set((SOURCES / TIPNR).read_text(encoding="utf-8").splitlines())
    fixture = (FIXTURES / TIPNR).read_text(encoding="utf-8").splitlines()
    assert not [line for line in fixture if line in real and not line.startswith("$==")]
