"""Curated tables (#7). The fixture tables are in tests/fixtures/curated."""

import shutil
import subprocess

import pytest
from conftest import CURATED as CURATED_FIXTURES
from conftest import VERSION, read_json, read_tsv, run_build

CURATED = {"source": "Curated", "licence": "CC BY-SA 4.0"}
THEOGRAPHIC = {"source": "Theographic", "licence": "CC BY-SA 4.0"}


def entity(export, entity_id):
    kind, name = entity_id.split(":")
    return read_json(export / "data" / VERSION / "entity" / kind / f"{name}.json")


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
    # spouse;concubine: both, each with the row's evidence. CONCUBINE_OF runs from her to him.
    hagar = edges(export, "person:abraham_58", "person:hagar_1348")
    assert [(e["edge"], e["direction"]) for e in hagar] == [
        ("CONCUBINE_OF", "in"),
        ("SPOUSE_OF", "both"),
    ]
    for e in hagar:
        assert e["evidence"] == evidence("Gen.16.3", "Gen.25.6")
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
    assert report(export, "curated_unreviewed") == [
        {"table": "corrections", "line": "8", "ids": "person:isaac_616 gender", "detail": "no"},
        {
            "table": "partners",
            "line": "7",
            "ids": "person:esau_1216 person:adah_414",
            "detail": "no",
        },
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


def test_a_redundant_correction_applies_and_is_reported(export):
    beeri = entity(export, "person:beeri_432")
    assert (beeri["gender"], beeri["corrections"][0]["value"]) == ("Male", "Male")
    assert report(export, "curated_redundant") == [
        {
            "table": "corrections",
            "line": "3",
            "ids": "person:beeri_432 gender",
            "detail": "Theographic now has Male",
        }
    ]


def test_a_row_that_no_longer_matches_is_not_applied_and_is_reported(export):
    ur = entity(export, "place:ur_1189")
    assert (ur["name"], "corrections" in ur) == ("Ur of the Chaldees", False)
    abraham = [n["id"] for n in entity(export, "person:abraham_58")["neighbours"]]
    assert "person:nobody_0" not in abraham
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
            "table": "partners",
            "line": "8",
            "ids": "person:abraham_58 person:nobody_0",
            "detail": "person:nobody_0 is not in Theographic",
        },
    ]


def test_rows_that_fix_plain_theographic_errors_are_listed_for_upstream_reporting(export):
    # Corrections and "none" partner rows that still match Theographic. The wife and concubine
    # rule and Possibly Same Person links are editorial (PRD 10.5 rule 4).
    assert [(r["table"], r["line"]) for r in report(export, "curated_upstream")] == [
        ("corrections", "2"),
        ("corrections", "6"),
        ("corrections", "7"),
        ("corrections", "8"),
        ("partners", "6"),
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


def broken_tables(tmp_path, evidence):
    folder = tmp_path / "curated"
    shutil.copytree(CURATED_FIXTURES, folder)
    table = folder / "possibly_same.csv"
    table.write_text(table.read_text().replace("Gen.26.34;Gen.36.2;Gen.36.24", evidence))
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
