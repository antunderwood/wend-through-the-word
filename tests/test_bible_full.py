"""Slow acceptance run of build.toml's book range (the whole Bible) on the real downloaded
sources. Skipped when they are missing (CI)."""

import gzip
import os
import tomllib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from conftest import REAL_CURATED, VERSION, entity, read_json, read_tsv, run_build, top_people

SOURCES = Path(os.environ.get("WEND_SOURCES", "sources"))
BOOKS = tomllib.loads((Path(__file__).parent.parent / "build.toml").read_text())["books"]

pytestmark = pytest.mark.skipif(
    not (SOURCES / "verses.json").exists(), reason=f"no downloaded sources in {SOURCES}"
)


@pytest.fixture(scope="module")
def bible(tmp_path_factory):
    return run_build(
        tmp_path_factory.mktemp("bible") / "out",
        sources=SOURCES,
        books=BOOKS,
        curated=REAL_CURATED,
    )


def test_the_bible_has_66_books_1189_chapters_and_31102_verses(bible):
    chapters = [
        p
        for p in (bible / "data" / VERSION / "chapter").rglob("*.json")
        if not p.name.endswith(".ring2.json")
    ]
    assert len({p.parent.name for p in chapters}) == 66
    assert read_json(bible / "data" / "index.json")["counts"] == {
        "chapters": 1189,
        "verses": 31102,
    }
    assert len(chapters) == 1189


def test_the_export_has_fewer_than_20000_files_all_under_the_compressed_limit(bible):
    files = list((bible / "data").rglob("*.json"))
    assert len(files) < 20000
    # Decision 163: under 500 KB gzipped (level 9) and 25 MiB raw. God's file is the largest raw.
    with ThreadPoolExecutor() as pool:
        gzipped = dict(zip(files, pool.map(lambda p: len(gzip.compress(p.read_bytes(), 9)), files)))
    assert not [p for p, n in gzipped.items() if n >= 500 * 1000 or p.stat().st_size >= 25 << 20]


def test_no_cross_references_are_trimmed(bible):
    assert not read_tsv(bible / "reports" / "split_or_trimmed.tsv")


def test_the_ring_1_people_of_abraham_jesus_and_paul(bible):
    # Values from the first whole-Bible run (2026-10-22). Abraham's are those of the Genesis build.
    assert top_people(entity(bible, "person:abraham_58")) == [
        "person:isaac_616",
        "person:sarah_2473",
        "person:heth_1510",
        "person:abimelech_40",
        "person:nahor_2143",
        "person:lot_1830",
    ]
    assert top_people(entity(bible, "person:jesus_905")) == [
        "person:god_1324",
        "person:peter_2745",
        "person:holy_spirit_7400",
        "person:paul_2479",
        # A Co-mention artefact: the letters say "Christ Jesus" in Verses that also name Timothy
        # (issue #64, formulaic phrases in the letters inflate Co-mentions). Kept as the expected
        # value until that issue changes the ranking (owner).
        "person:timotheus_2863",
        "person:pilate_2365",
    ]
    assert top_people(entity(bible, "person:paul_2479")) == [
        "person:barnabas_1722",
        "person:silas_2740",
        "person:timotheus_2863",
        "person:apollos_276",
        "person:portius_2367",
        "person:felix_1257",
    ]


def test_cosine_keeps_god_out_of_the_top_6_people_of_most_people(bible):
    people = [read_json(p) for p in (bible / "data" / VERSION / "entity" / "person").glob("*")]
    people = [e for e in people if e["verses"]]  # stubs have no Verse in range
    with_god = [e["id"] for e in people if "person:god_1324" in top_people(e)]
    # First run: 245 of 3,067 (decisions 20 and 95).
    assert len(with_god) <= len(people) // 10


def test_names_take_the_bsb_spelling_unless_it_is_unsafe(bible):
    # Decision 172 on the real sources: KJV forms take the BSB's spelling, and the curated rows
    # (reviewed) win. Kept: an ordinary word (Ethiopia is never "Topaz"), a people's adjective
    # (Lycaonian), a description, a compound (Ben-abinadab), a tie (Aiah and Anah), and a name
    # with a curly apostrophe in the BSB.
    names = {
        "person:timotheus_2863": "Timothy",
        "person:aholibamah_1761": "Oholibamah",
        "person:philip_2344": "Philip the Apostle",
        "person:jesus_904": "Jesus called Justus",
        "place:ethiopia_419": "Ethiopia",
        "place:lycaonia_739": "Lycaonia",
        "person:son_of_abinadab_2763": "son of Abinadab",
        "person:ajah_178": "Ajah",
        "place:solomons_portico_1109": "Solomon's Portico",
    }
    assert {i: entity(bible, i)["name"] for i in names} == names
    assert "Timotheus" in entity(bible, "person:timotheus_2863")["aliases"]
    # Curated aliases remove the Themes that duplicated People by their short names (decision 173).
    themes = bible / "data" / VERSION / "entity" / "theme"
    assert not [h for h in ("mark", "peter", "festus", "lysias") if (themes / f"{h}.json").exists()]
