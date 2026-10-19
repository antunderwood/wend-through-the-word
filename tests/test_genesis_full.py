"""Slow acceptance run on the real downloaded sources. Skipped when they are missing (CI)."""

import os
import re
from collections import Counter
from pathlib import Path

import pytest
from conftest import (
    FIXTURES,
    REAL_CURATED,
    TIPNR,
    VERSION,
    compressed_size,
    openstreetmap_shipped,
    read_json,
    read_tsv,
    run_build,
    search,
    search_index,
    shipped_points,
    top_people,
)

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
    assert in_range == {"person": 352, "place": 119, "event": 116, "theme": 544}
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
        n["id"]
        for n in isaac["neighbours"]
        if any(x["edge"] == "HALF_SIBLING_OF" for x in n["edges"])
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
        explicit = [e for e in n[0]["edges"] if e["edge"] != "CO_MENTION"]
        return [(e["edge"], [v["label"] for v in e.get("evidence", [])]) for e in explicit]

    assert edges("abraham_58", "sarah_2473") == [("SPOUSE_OF", ["Gen.11.29"])]
    # One row per relation, so each edge cites only its own verse.
    assert edges("abraham_58", "hagar_1348") == [
        ("CONCUBINE_OF", ["Gen.25.6"]),
        ("SPOUSE_OF", ["Gen.16.3"]),
    ]
    assert edges("anah_247", "beeri_432") == [
        ("POSSIBLY_SAME_AS", ["Gen.26.34", "Gen.36.2", "Gen.36.24"])
    ]
    anah = read_json(entity / "anah_247.json")
    assert (anah["gender"], anah["corrections"][0]["was"]) == ("Male", "Female")
    for name in ("redundant", "no_longer_matches"):
        assert read_tsv(genesis / "reports" / f"curated_{name}.tsv") == []
    unreviewed = read_tsv(genesis / "reports" / "curated_unreviewed.tsv")
    assert [r["ids"] for r in unreviewed if r["table"] == "corrections"] == [
        "place:mount_of_olives_828 aliases",
        "place:nile_895 coordinates",  # owner to confirm (decision 90)
        "place:gihon_472 coordinates",
    ]
    # The owner reviewed themes_keep.csv on 2026-10-19 (decision 109).
    assert not [r for r in unreviewed if r["table"] == "themes_keep"]
    kept = {
        r["heading"]
        for r in read_tsv(genesis / "reports" / "removed_theme_headings.tsv")
        if r["keep_row"] == "yes"
    }
    assert kept == {
        "GOD",
        "HOLY SPIRIT",
        "SALT",
        "LIGHT",
        "SUN",
        "MASTER",
        "DAUGHTER",
        "WIFE",
        "FIRSTBORN",
    }
    themes = genesis / "data" / VERSION / "entity" / "theme"
    assert read_json(themes / "god.json")["name"] == "God (topic)"
    assert read_json(themes / "holy_spirit.json")["name"] == "Holy Spirit (topic)"
    assert not (themes / "canaanites.json").exists()


def test_genesis_verses_hold_3348_mentions_all_with_a_verse_key(genesis):
    chapters = chapter_files(genesis)
    mentions = [m for p in chapters for v in read_json(p)["verses"] for m in v["mentions"]]
    assert len(mentions) == 3348
    rows = read_tsv(genesis / "reports" / "verse_mismatches.tsv")
    assert not [r for r in rows if "mention" in r["cause"]]


def test_a_search_for_abraham_returns_abraham_and_the_index_is_below_500_kb_compressed(genesis):
    assert search(search_index(genesis), "Abraham") == ["person:abraham_58"]
    assert compressed_size(genesis) < 500 * 1000


def test_a_search_for_luz_finds_bethel(genesis):
    # Luz is its own Place (decision 7) and an other name of Bethel (decision 65).
    assert search(search_index(genesis), "Luz") == ["place:bethel_202", "place:luz_737"]


def test_creation_in_4004_bc_is_exported_as_minus_4003(genesis):
    event = read_json(genesis / "data" / VERSION / "entity" / "event" / "1.json")
    assert event["event_year"] == -4003


def test_every_genesis_place_has_a_cc_by_point_or_is_in_the_no_coordinate_report(genesis):
    shipped = shipped_points(genesis)
    assert not openstreetmap_shipped(genesis, SOURCES)
    report = {r["place"]: r["cause"] for r in read_tsv(genesis / "reports" / "no_coordinate.tsv")}
    assert (len(shipped), len(report)) == (111, 8)
    assert report["place:galeed_432"] == "no OpenBible link"
    assert report["place:eden_354"] == "OpenBible gives no point"


def test_every_dropped_genesis_point_is_re_sourced(genesis):
    # 47 OpenBible points are on OpenStreetMap geometry (decision 57); all are looked up again.
    sources = Counter(p["coord_source"] for p in shipped_points(genesis))
    assert sources == {"OpenBible": 64, "Pleiades": 17, "Wikidata": 28, "GeoNames": 2}
    euphrates = read_json(genesis / "data" / VERSION / "entity" / "place" / "euphrates_421.json")
    assert euphrates["coord_source"] == "Pleiades"


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


def test_cosine_keeps_god_out_of_most_top_6_people_and_ranks_abrahams_people(genesis):
    entity = genesis / "data" / VERSION / "entity"
    people = [read_json(p) for p in (entity / "person").glob("*.json")]
    people = [e for e in people if e["verses"]]  # the 352 in Genesis, not the stubs
    # God is in more Verses than anyone; cosine over whole-Bible Verse sets demotes him
    # (decisions 20 and 95). Owner's expected result: about 19 of 352.
    with_god = [e["id"] for e in people if "person:god_1324" in top_people(e)]
    assert len(with_god) <= len(people) // 10
    abraham = read_json(entity / "person" / "abraham_58.json")
    assert top_people(abraham) == [
        "person:isaac_616",
        "person:sarah_2473",
        "person:heth_1510",
        "person:abimelech_40",
        "person:nahor_2143",
        "person:lot_1830",
    ]


def test_genesis_themes_file_5470_verses_and_only_kept_ones_have_a_person_or_place_name(genesis):
    entity = genesis / "data" / VERSION / "entity"
    verses = [v for p in chapter_files(genesis) for v in read_json(p)["verses"]]
    assert sum(len(v["filed_under"]) for v in verses) == 5470

    # PRD 12.13: no Theme has the name or an alias of a Theographic Person or Place ("Jacob
    # (Israel)" is Jacob). A heading that matches only a part before a comma is kept and reported.
    def norm(name):
        return re.sub(r"[^a-z]", "", name.lower())

    files = [read_json(p) for kind in ("person", "place") for p in entity.glob(f"{kind}/*.json")]
    names = {norm(re.sub(r"\s*\(.*\)$", "", e["name"])) for e in files}
    names |= {norm(a) for e in files for a in e["aliases"]}
    themes = [read_json(p)["name"] for p in (entity / "theme").glob("*.json")]
    assert len(themes) == 544
    clashes = {t for t in themes if norm(re.sub(r"\s*\(.*\)$", "", t)) in names}
    # Only headings the owner kept (decision 109) may share a name with an Entity.
    kept = {"God (topic)", "Holy Spirit (topic)", "SALT", "LIGHT", "SUN", "MASTER", "DAUGHTER"}
    assert clashes <= kept | {"WIFE", "FIRSTBORN"}
    rows = read_tsv(genesis / "reports" / "removed_theme_headings.tsv")
    # The owner kept nine headings (decision 109); the four peoples are removed.
    assert Counter((r["action"], r["match"], r["keep_row"]) for r in rows) == {
        ("removed", "name", ""): 380,
        ("kept", "name", "yes"): 3,  # GOD, HOLY SPIRIT, SALT
        ("removed", "alias", ""): 25,
        ("kept", "alias", "yes"): 6,  # LIGHT, SUN, MASTER, DAUGHTER, WIFE, FIRSTBORN
        ("kept", "part of the heading", ""): 1,  # JESUS, THE CHRIST
    }
    removed = {r["heading"] for r in rows if r["action"] == "removed"}
    duplicates = ["MELCHIZEDEK", "REBEKAH (REBECCA)", "ZAPHNATH-PAANEAH", "BEN-ONI", "JUDITH"]
    assert removed >= {*duplicates, "HEMAM", "PHALLU", "CANAANITES", "MOABITES"}


def test_genesis_tipnr_check_reports_48_disagreements(genesis):
    rows = read_tsv(genesis / "reports" / "tipnr_disagreements.tsv")
    # 46 without the curated partners, which settle 3 "partners" rows; 5 are on gender.
    assert len(rows) == 48
    # Theographic's own gender, before the curated correction (decision 88).
    assert {
        "person": "person:anah_247",
        "tipnr_person": "Anah@Gen.36.2-1Ch",
        "field": "gender",
        "theographic": "Female",
        "tipnr": "Male",
    } in rows
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
