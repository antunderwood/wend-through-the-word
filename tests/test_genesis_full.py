"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
from collections import Counter
from pathlib import Path

import pytest
from conftest import REAL_CURATED, VERSION, read_json, read_tsv, run_build
from test_coordinates import openstreetmap_points, shipped_points

SOURCES = Path(os.environ.get("WEND_SOURCES", "sources"))

pytestmark = pytest.mark.skipif(
    not (SOURCES / "verses.json").exists(), reason=f"no downloaded sources in {SOURCES}"
)


@pytest.fixture(scope="module")
def genesis(tmp_path_factory):
    return run_build(
        tmp_path_factory.mktemp("genesis") / "out",
        sources=SOURCES,
        books=["Gen"],
        curated=REAL_CURATED,
    )


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


def test_genesis_curates_21_of_its_23_partner_pairs(genesis):
    # The other 2 have one end outside Genesis: Maachah and Machir, Abiah and Hezron.
    assert read_tsv(genesis / "reports" / "uncurated_partners.tsv") == [
        {"man_id": "person:hezron_1520", "woman_id": "person:abiah_16"},
        {"man_id": "person:machir_1877", "woman_id": "person:maachah_1843"},
    ]


def test_genesis_ships_the_real_curated_tables(genesis):
    entity = genesis / "data" / VERSION / "entity" / "person"

    def edges(a, b):
        n = [n for n in read_json(entity / f"{a}.json")["neighbours"] if n["id"] == f"person:{b}"]
        return [(e["edge"], [v["label"] for v in e.get("evidence", [])]) for e in n[0]["edges"]]

    assert edges("abraham_58", "sarah_2473") == [("SPOUSE_OF", ["Gen.11.29"])]
    both = ["Gen.16.3", "Gen.25.6"]
    assert edges("abraham_58", "hagar_1348") == [("CONCUBINE_OF", both), ("SPOUSE_OF", both)]
    assert edges("anah_247", "beeri_432") == [
        ("POSSIBLY_SAME_AS", ["Gen.26.34", "Gen.36.2", "Gen.36.24"])
    ]
    anah = read_json(entity / "anah_247.json")
    assert (anah["gender"], anah["corrections"][0]["was"]) == ("Male", "Female")
    for name in ("redundant", "no_longer_matches"):
        assert read_tsv(genesis / "reports" / f"curated_{name}.tsv") == []
    unreviewed = read_tsv(genesis / "reports" / "curated_unreviewed.tsv")
    assert [r["ids"] for r in unreviewed] == ["place:mount_of_olives_828 aliases"]


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
