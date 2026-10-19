"""TIPNR check (#13). The fixture is synthetic: TIPNR asks not to be reposted (licences.md 5.4)."""

from conftest import FIXTURES, read_tsv

TIPNR = (
    "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt"
)


def disagreements(export, person):
    rows = read_tsv(export / "reports" / "tipnr_disagreements.tsv")
    return [r for r in rows if r["person"] == person]


def test_a_tipnr_person_matched_by_verses_with_a_different_father_is_reported(export):
    # Synthetic TIPNR Serug shares Theographic Serug's verses but names Peleg as his father.
    assert {
        "person": "person:serug_2503",
        "tipnr_person": "Serug@Gen.11.20-Luk",
        "field": "father",
        "theographic": "person:reu_2428",
        "tipnr": "person:peleg_2308",
    } in disagreements(export, "person:serug_2503")


def test_a_tipnr_person_that_matches_and_agrees_is_not_reported(export):
    # Synthetic TIPNR Reu names Peleg as father and Serug as child, as Theographic does.
    assert disagreements(export, "person:reu_2428") == []


def test_a_person_in_range_with_no_tipnr_match_is_reported_as_identity(export):
    # The synthetic TIPNR file has no Abraham.
    assert disagreements(export, "person:abraham_58") == [
        {
            "person": "person:abraham_58",
            "tipnr_person": "",
            "field": "identity",
            "theographic": "person:abraham_58",
            "tipnr": "",
        }
    ]


def tipnr_values(path):
    """Values only TIPNR holds: record keys ("Reu@Gen.11.18-Luk"), descriptions, Strong's."""
    fields = {f for line in path.read_text(encoding="utf-8").splitlines() for f in line.split("\t")}
    return {f for f in fields if "@" in f or "Synthetic" in f or f.startswith("HX0")}


def test_no_exported_file_contains_a_tipnr_value(export):
    values = tipnr_values(FIXTURES / TIPNR)
    assert len(values) > 10
    for path in (export / "data").rglob("*.json"):
        text = path.read_text()
        assert not [v for v in values if v in text], path


def test_the_tipnr_fixture_is_synthetic():
    # Every record says it is synthetic and has a made-up Strong's number (licences.md 5.4).
    # The full run also checks that no fixture line is in the real file.
    text = (FIXTURES / TIPNR).read_text(encoding="utf-8")
    heads = [r.splitlines()[1] for r in text.split("\n$========== ")[1:]]
    assert len(heads) == 4
    for head in heads:
        key, description = head.split("\t")[:2]
        assert description == "Synthetic TIPNR record, written for tests"
        assert key.split("=")[1].startswith("HX0")
