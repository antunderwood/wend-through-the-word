from conftest import VERSION, read_json, read_tsv, search, search_index


def person(export, name):
    return read_json(export / "data" / VERSION / "entity" / "person" / f"{name}.json")


def test_a_kjv_name_takes_the_bsb_spelling_and_stays_an_alias(export):
    # Theographic's Aholibamah is Oholibamah in the BSB of Gen 36:2 and the rest of her Verses.
    aholibamah = person(export, "aholibamah_1761")
    assert aholibamah["name"] == "Oholibamah"
    assert "Aholibamah" in aholibamah["aliases"]
    assert search(search_index(export), "Aholibamah") == search(search_index(export), "Oholibamah")
    rows = read_tsv(export / "reports" / "bsb_names.tsv")
    assert {
        "id": "person:aholibamah_1761",
        "theographic_name": "Aholibamah",
        "bsb_name": "Oholibamah",
    } in rows
    # A name the BSB uses keeps it.
    assert person(export, "abraham_58")["name"] == "Abraham"
    assert "person:abraham_58" not in [r["id"] for r in rows]


def test_a_curated_name_wins_over_the_bsb_spelling(export):
    # Fixture corrections.csv: Salah (the BSB's Shelah) is curated as "Shelah (synthetic)".
    salah = person(export, "salah_2455")
    assert salah["name"] == "Shelah (synthetic)"
    assert "Salah" in salah["aliases"]
    rows = read_tsv(export / "reports" / "bsb_names.tsv")
    assert "person:salah_2455" not in [r["id"] for r in rows]


def test_a_curated_alias_is_added_and_a_heading_matching_it_or_a_bsb_name_is_removed(export):
    # Fixture: Hagar's synthetic alias; Nave's synthetic headings HAGAR THE EGYPTIAN and OHOLIBAMAH.
    assert "Hagar the Egyptian" in person(export, "hagar_1348")["aliases"]
    removed = {r["heading"]: r for r in read_tsv(export / "reports" / "removed_theme_headings.tsv")}
    assert removed["HAGAR THE EGYPTIAN"]["entity_ids"] == "person:hagar_1348"
    assert removed["HAGAR THE EGYPTIAN"]["match"] == "alias"
    assert removed["OHOLIBAMAH"]["action"] == "removed"
    assert "person:aholibamah_1761" in removed["OHOLIBAMAH"]["entity_ids"]
