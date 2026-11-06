"""The ACAI check (decision 217, #128): ACAI's tags against Theographic's, reported, never shipped.
The fixture ACAI zip is synthetic (tests/fixtures/make_acai.py says what each record tests)."""

from conftest import read_json, read_tsv


def rows(export, name):
    return read_tsv(export / "reports" / f"{name}.tsv")


def test_a_mention_only_one_side_has_is_reported_by_verse(export):
    assert rows(export, "acai_mentions") == [
        # Abraham's synthetic extra ACAI reference
        {"verse": "Gen.11.1", "entity": "person:abraham_58", "acai_id": "person:Abraham",
         "only_in": "ACAI"},
        # The real upstream error: Theographic tags Lydia on "Lotan"; ACAI has her in Acts only.
        {"verse": "Gen.36.22", "entity": "person:lydia_1837", "acai_id": "person:Lydia",
         "only_in": "Theographic"},
    ]  # fmt: skip


def test_a_family_link_the_two_disagree_on_is_reported(export):
    family = [r for r in rows(export, "acai_disagreements") if r["field"] != "identity"]
    assert family == [
        {"entity": "person:isaac_616", "acai_id": "person:Isaac", "field": "father",
         "theographic": "person:abraham_58", "acai": "person:nahor_2142"},
    ]  # fmt: skip


def test_an_entity_no_acai_record_names_or_several_name_is_an_identity_row(export):
    identity = {r["entity"]: r for r in rows(export, "acai_disagreements")}
    assert identity["person:sarah_2473"]["acai_id"] == ""  # no ACAI record
    assert identity["person:esau_1216"]["acai"] == "person:Edom.person, person:Esau"
    assert "person:terah_2841" not in identity  # one record, agreeing
    assert "place:babel_150" in identity  # Places are checked too


def test_the_crosswalk_gives_each_entity_its_acai_record_and_their_ids(export):
    crosswalk = {(r["entity"], r["acai_id"]): r for r in rows(export, "acai_crosswalk")}
    assert crosswalk["person:abraham_58", "person:Abraham"]["tipnr"] == "Abraham@synthetic"
    assert ("person:esau_1216", "person:Edom.person") in crosswalk
    assert len(crosswalk) == 7


def test_nothing_from_acai_reaches_the_export(export):
    assert "acai" not in read_json(export / "data" / "index.json")["sources"]
    for path in (export / "data").rglob("*.json"):
        text = path.read_text()
        assert "@synthetic" not in text and '"person:Abraham"' not in text, path
