"""Curated tables (#7). The fixture tables are in tests/fixtures/curated."""

import shutil
import subprocess

import pytest
from conftest import CURATED as CURATED_FIXTURES
from conftest import chapter_verse, entity, read_tsv, run_build

CURATED = {"source": "Curated", "licence": "CC BY-SA 4.0"}
THEOGRAPHIC = {"source": "Theographic", "licence": "CC BY-SA 4.0"}


def edges(export, entity_id, other_id):
    """The explicit edges of a Neighbour, without the CO_MENTION (#8) that most pairs also have."""
    n = [n for n in entity(export, entity_id)["neighbours"] if n["id"] == other_id]
    return [e for e in n[0]["edges"] if e["edge"] != "CO_MENTION"] if n else []


def evidence(*labels):
    keys = {"Gen.11.29": "01011029", "Gen.16.3": "01016003", "Gen.25.6": "01025006"}
    return [{"verse_key": keys[label], "label": label} for label in labels]


def test_abraham_and_sarah_ship_as_spouses_with_their_evidence(export):
    assert edges(export, "person:abraham_58", "person:sarah_2473") == [
        {
            "edge": "SPOUSE_OF",
            "direction": "both",
            **CURATED,
            "evidence": evidence("Gen.11.29"),
            "note": '"Abram\'s wife was named Sarai"',
            "request": None,
        }
    ]


def edge_types(export, entity_id, other_id):
    return [(e["edge"], e["direction"]) for e in edges(export, entity_id, other_id)]


def test_each_partner_relation_value_gives_its_edges(export):
    # spouse and concubine: one row each, so each edge cites only the verse that supports it.
    # CONCUBINE_OF runs from her to him.
    hagar = edges(export, "person:abraham_58", "person:hagar_1348")
    assert [(e["edge"], e["direction"], e["evidence"]) for e in hagar] == [
        ("CONCUBINE_OF", "in", evidence("Gen.25.6")),
        ("SPOUSE_OF", "both", evidence("Gen.16.3")),
    ]
    for e in hagar:
        assert e["request"] == "https://github.com/antunderwood/wend-through-the-word/issues/900"
    assert edge_types(export, "person:hagar_1348", "person:abraham_58") == [
        ("CONCUBINE_OF", "out"),
        ("SPOUSE_OF", "both"),
    ]
    # concubine
    assert edge_types(export, "person:timna_2860", "person:eliphaz_1144") == [
        ("CONCUBINE_OF", "out")
    ]
    # partner: a curated PARTNER_OF, with its evidence
    basemath = edges(export, "person:esau_1216", "person:bashemath_1887")
    assert [(e["edge"], e["source"], e["note"]) for e in basemath] == [
        ("PARTNER_OF", "Curated", "Synthetic: tests the partner value")
    ]
    # none
    anah = edges(export, "person:anah_247", "person:beeri_432")
    assert "PARTNER_OF" not in {e["edge"] for e in anah}


def test_a_pair_with_no_row_ships_as_partner_of_and_is_reported_uncurated(export):
    assert edges(export, "person:isaac_616", "person:rebekah_2401") == [
        {"edge": "PARTNER_OF", "direction": "both", **THEOGRAPHIC}
    ]
    rows = read_tsv(export / "reports" / "uncurated_partners.tsv")
    assert {"man_id": "person:isaac_616", "woman_id": "person:rebekah_2401"} in rows
    assert {"man_id": "person:abraham_58", "woman_id": "person:sarah_2473"} not in rows


def report(export, name):
    return read_tsv(export / "reports" / f"{name}.tsv")


def test_an_unreviewed_row_does_not_ship_and_is_reported(export):
    assert edge_types(export, "person:esau_1216", "person:adah_414") == [("PARTNER_OF", "both")]
    assert entity(export, "person:isaac_616")["gender"] == "Male"
    assert edge_types(export, "person:abraham_58", "person:isaac_616")[0] == ("PARENT_OF", "out")
    assert report(export, "curated_unreviewed") == [
        {"table": "corrections", "line": "8", "ids": "person:isaac_616 gender", "detail": "no"},
        {
            "table": "links",
            "line": "8",
            "ids": "remove person:abraham_58 PARENT_OF person:isaac_616",
            "detail": "no",
        },
        {
            "table": "partners",
            "line": "8",
            "ids": "person:esau_1216 person:adah_414",
            "detail": "no",
        },
        {"table": "themes_keep", "line": "3", "ids": "MASTER", "detail": "no"},
    ]


def test_anah_and_beeri_are_possibly_the_same_person_with_evidence_and_note(export):
    link = edges(export, "person:anah_247", "person:beeri_432")
    assert [(e["edge"], e["direction"], e["source"]) for e in link] == [
        ("POSSIBLY_SAME_AS", "both", "Curated")
    ]
    assert [v["label"] for v in link[0]["evidence"]] == ["Gen.26.34", "Gen.36.2", "Gen.36.24"]
    assert link[0]["note"].startswith('Esau\'s wife is "Judith daughter of Beeri"')
    assert edge_types(export, "person:beeri_432", "person:anah_247") == [
        ("POSSIBLY_SAME_AS", "both")
    ]


def test_anah_ships_as_male_with_the_correction_and_its_evidence(export):
    anah = entity(export, "person:anah_247")
    assert anah["gender"] == "Male"
    assert anah["corrections"] == [
        {
            "field": "gender",
            "was": "Female",
            "value": "Male",
            **CURATED,
            "evidence": [{"verse_key": "01036024", "label": "Gen.36.24"}],
            "note": 'BSB Gen.36.24 reads "Anah son of Zibeon".',
            "request": None,
        }
    ]
    # The edges step reads the corrected gender (decision 69).
    child = edges(export, "person:anah_247", "person:aholibamah_1761")
    assert [(e["edge"], e["role"]) for e in child] == [("PARENT_OF", "father")]
    assert "corrections" not in entity(export, "person:abraham_58")


def test_a_redundant_row_is_reported_and_a_redundant_link_changes_nothing(export):
    beeri = entity(export, "person:beeri_432")
    assert (beeri["gender"], beeri["corrections"][0]["value"]) == ("Male", "Male")
    # Theographic already has the Mention, so it ships as Theographic's.
    mentions = {m["id"]: m for m in chapter_verse(export, "Gen.36.24")["mentions"]}
    assert mentions["person:anah_249"]["source"] == "Theographic"
    assert report(export, "curated_redundant") == [
        {
            "table": "corrections",
            "line": "3",
            "ids": "person:beeri_432 gender",
            "detail": "Theographic now has Male",
        },
        {
            "table": "links",
            "line": "10",
            "ids": "add Gen.36.24 MENTIONS person:anah_249",
            "detail": "Theographic now has the link",
        },
    ]


def test_a_row_that_no_longer_matches_is_not_applied_and_is_reported(export):
    ur = entity(export, "place:ur_1189")
    assert (ur["name"], "corrections" in ur) == ("Ur of the Chaldees", False)
    abraham = [n["id"] for n in entity(export, "person:abraham_58")["neighbours"]]
    assert "person:nobody_0" not in abraham
    isaac = [n["id"] for n in entity(export, "person:isaac_616")["neighbours"]]
    assert "person:nobody_0" not in isaac
    assert report(export, "curated_no_longer_matches") == [
        {
            "table": "corrections",
            "line": "4",
            "ids": "place:ur_1189 name",
            "detail": "Theographic has Ur of the Chaldees, not Ur of Chaldea or Ur of the Chaldeans",
        },
        {
            "table": "corrections",
            "line": "5",
            "ids": "person:nobody_0 gender",
            "detail": "person:nobody_0 is not in Theographic",
        },
        {
            "table": "links",
            "line": "9",
            "ids": "add person:nobody_0 PARENT_OF person:isaac_616",
            "detail": "person:nobody_0 is not in Theographic",
        },
        {
            "table": "partners",
            "line": "9",
            "ids": "person:abraham_58 person:nobody_0",
            "detail": "person:nobody_0 is not in Theographic",
        },
    ]


def test_rows_that_fix_plain_theographic_errors_are_listed_for_upstream_reporting(export):
    # Corrections, link rows, and "none" partner rows that still match Theographic. The wife and
    # concubine rule and Possibly Same Person links are editorial (PRD 10.5 rule 4).
    assert [(r["table"], r["line"]) for r in report(export, "curated_upstream")] == [
        ("corrections", "2"),
        ("corrections", "6"),
        ("corrections", "7"),
        ("corrections", "8"),
        *[("links", str(line)) for line in (11, 12, *range(2, 9))],  # lines sort as text
        ("partners", "7"),
    ]


def test_an_alias_correction_removes_or_replaces_one_alias_and_every_alias_is_reported(export):
    older = entity(export, "person:daughter_of_lot_older_985")  # stubs: Lot's daughters
    younger = entity(export, "person:daughter_of_lot_younger_984")
    assert (older["aliases"], younger["aliases"]) == ([], ["younger daughter"])
    assert younger["corrections"][0]["was"] == "daughters"
    rows = report(export, "aliases")
    assert {"id": "person:daughter_of_lot_younger_984", "alias": "younger daughter"} in rows
    assert {"id": "place:canaan_272", "alias": "Promised Land"} in rows
    assert "firstborn" not in [r["alias"] for r in rows]


# The Evidence Verses of the Gen 36:25 rows in links.csv (#44).
GEN_36_25 = [
    {"verse_key": "01036024", "label": "Gen.36.24"},
    {"verse_key": "01036025", "label": "Gen.36.25"},
]


def test_the_gen_36_25_mention_moves_from_the_son_of_seir_to_the_son_of_zibeon(export):
    mentions = {m["id"]: m for m in chapter_verse(export, "Gen.36.25")["mentions"]}
    assert "person:anah_248" not in mentions
    anah = mentions["person:anah_249"]
    assert (anah["source"], anah["evidence"], anah["request"]) == ("Curated", GEN_36_25, None)
    assert anah["note"].startswith("The owner's reading, with most commentators")
    assert mentions["person:dishon_1017"]["source"] == "Theographic"
    # Each Anah's own list of Verses agrees, with the same provenance.
    assert "01036025" not in [v["key"] for v in entity(export, "person:anah_248")["verses"]]
    verse = next(v for v in entity(export, "person:anah_249")["verses"] if v["key"] == "01036025")
    assert (verse["edge"], verse["source"], verse["evidence"]) == ("MENTIONS", "Curated", GEN_36_25)


def test_dishon_and_aholibamah_move_to_the_son_of_zibeon(export):
    for child in ("person:dishon_1017", "person:aholibamah_172"):
        assert edges(export, "person:anah_248", child) == []
        (parent,) = edges(export, "person:anah_249", child)
        assert {k: parent[k] for k in ("edge", "direction", "role", "source", "evidence")} == {
            "edge": "PARENT_OF",
            "direction": "out",
            "role": "father",
            "source": "Curated",
            "evidence": GEN_36_25,
        }


def test_each_entity_at_an_end_of_a_corrected_link_is_marked_corrected_after_review(export):
    def fixes(entity_id):
        return [
            (c["field"], c["was"], c["value"]) for c in entity(export, entity_id)["corrections"]
        ]

    assert fixes("person:anah_248") == [
        ("link", "Gen.36.25 MENTIONS person:anah_248", ""),
        ("link", "person:anah_248 PARENT_OF person:dishon_1017", ""),
        ("link", "person:anah_248 PARENT_OF person:aholibamah_172", ""),
        # 1 Chr 1:41 is outside the range: only the whole-Bible Verse sets change.
        ("link", "1Chr.1.41 MENTIONS person:anah_248", ""),
    ]
    assert fixes("person:dishon_1017") == [
        ("link", "person:anah_248 PARENT_OF person:dishon_1017", ""),
        ("link", "", "person:anah_249 PARENT_OF person:dishon_1017"),
    ]
    assert entity(export, "person:anah_249")["corrections"][0]["evidence"] == GEN_36_25


def broken_tables(tmp_path, new, table="possibly_same.csv", old="Gen.26.34;Gen.36.2;Gen.36.24"):
    """A copy of the fixture tables with `old` replaced by `new` in one table."""
    folder = tmp_path / "curated"
    shutil.copytree(CURATED_FIXTURES, folder)
    path = folder / table
    path.write_text(path.read_text().replace(old, new))
    return folder


@pytest.mark.parametrize(
    "bad, message",
    [
        ("", "possibly_same.csv line 2: no Evidence Verse"),
        ("Gen.26.34;Gen.99.1", "possibly_same.csv line 2: Gen.99.1 is not a Verse Key"),
    ],
)
def test_a_row_with_no_evidence_or_evidence_that_does_not_parse_fails_the_build(
    tmp_path, capfd, bad, message
):
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=broken_tables(tmp_path, bad))
    assert message in capfd.readouterr().err


def test_a_partner_row_with_two_relations_fails_the_build(tmp_path, capfd):
    # One row per relation, so each edge carries only its own evidence.
    new, old = "timna_2860,spouse;concubine", "timna_2860,concubine"
    folder = broken_tables(tmp_path, new, "partners.csv", old)
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=folder)
    assert "partners.csv line 5: relation spouse;concubine is not one of" in capfd.readouterr().err


@pytest.mark.parametrize(
    "new, old, message",
    [
        (
            "abraham_58,CHILD_OF",
            "abraham_58,PARENT_OF",
            "links.csv line 8: remove CHILD_OF is not add or remove, then one of MENTIONS,",
        ),
        ("add,Gen.99.1,MENTIONS", "add,Gen.36.24,MENTIONS", "links.csv line 10: Gen.99.1 is not"),
    ],
)
def test_a_links_row_that_does_not_name_one_link_fails_the_build(
    tmp_path, capfd, new, old, message
):
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=broken_tables(tmp_path, new, "links.csv", old))
    assert message in capfd.readouterr().err
