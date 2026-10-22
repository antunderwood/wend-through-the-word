from conftest import VERSION, chapter_verse, neighbour, read_json, read_tsv, search, search_index

NAVES = {"source": "Nave's Topical Bible", "licence": "CC BY 4.0"}


def theme(export, name):
    return read_json(export / "data" / VERSION / "entity" / "theme" / f"{name}.json")


def test_a_kept_heading_is_a_theme_entity_with_its_filed_under_verses(export):
    birthright = theme(export, "birthright")
    assert {k: birthright[k] for k in ("id", "type", "name", "source", "licence")} == {
        "id": "theme:birthright",
        "type": "theme",
        "name": "BIRTHRIGHT",
        **NAVES,
    }
    # Fixture: GEN 25:29-34 and 25:33, and a synthetic range across chapters, GEN 25:33-26:1.
    # Its other references (HEB 12:16, ROM 9:12,13, ...) are outside the book range.
    keys = ["01025029", "01025030", "01025031", "01025032", "01025033", "01025034", "01026001"]
    assert sorted(v["key"] for v in birthright["verses"]) == keys
    assert {
        (v["edge"], v["direction"], v["source"], v["licence"]) for v in birthright["verses"]
    } == {("FILED_UNDER", "in", *NAVES.values())}


def test_a_verse_links_to_its_themes_by_filed_under_not_mentions(export):
    verse = chapter_verse(export, "Gen.25.29")
    birthright = next(m for m in verse["filed_under"] if m["id"] == "theme:birthright")
    assert {k: birthright[k] for k in ("edge", "source", "licence")} == {
        "edge": "FILED_UNDER",
        **NAVES,
    }
    assert not [m for m in verse["mentions"] if m["id"].startswith("theme:")]


def test_a_filed_under_link_carries_the_subheadings_that_file_the_verse(export):
    # Fixture: "-Sold by Esau GEN 25:29-34; 25:33; ..." files Gen 25:33 twice, and the synthetic
    # line "-Synthetic test line GEN 25:33-26:1" files it again.
    def subheadings(ref):
        verse = chapter_verse(export, ref)
        return next(m for m in verse["filed_under"] if m["id"] == "theme:birthright")["subheadings"]

    assert subheadings("Gen.25.29") == ["Sold by Esau"]
    assert subheadings("Gen.25.33") == ["Sold by Esau", "Synthetic test line"]
    # The Theme's side of the link, its Verse Neighbour, carries them too.
    gen_25_29 = next(v for v in theme(export, "birthright")["verses"] if v["key"] == "01025029")
    assert gen_25_29["subheadings"] == ["Sold by Esau"]


def removed(export):
    rows = read_tsv(export / "reports" / "removed_theme_headings.tsv")
    return {r.pop("heading"): r for r in rows}


def test_a_heading_that_names_a_person_or_place_is_removed_and_reported(export):
    themes = export / "data" / VERSION / "entity" / "theme"
    assert not (themes / "hagar.json").exists()
    assert not (themes / "jacob.json").exists()  # Theographic's name is Israel; Jacob (Israel)
    rows = removed(export)
    assert rows["HAGAR"] == {
        "action": "removed",
        "match": "name",
        "entity_ids": "person:hagar_1348",
        "keep_row": "",
    }
    assert rows["CANAAN"]["entity_ids"] == "person:canaan_914 place:canaan_272"


def test_a_heading_spelt_two_ways_or_written_surname_first_is_removed(export):
    # Synthetic rows: "ABRAHAMUS (ABRAHAM)" names Abraham in its brackets, and "ANTIPAS, HEROD"
    # is "Herod Antipas" written surname first, as Nave's writes "PILATE, PONTIUS".
    rows = removed(export)
    assert rows["ABRAHAMUS (ABRAHAM)"]["action"] == "removed"
    assert rows["ABRAHAMUS (ABRAHAM)"]["entity_ids"] == "person:abraham_58"
    assert rows["ANTIPAS, HEROD"]["action"] == "removed"
    assert not (export / "data" / VERSION / "entity" / "theme" / "antipas_herod.json").exists()


def test_a_heading_that_matches_an_alias_is_removed_and_reported(export):
    # Judith is Aholibamah's other name (Gen 26:34, 36:2), so the Theme would duplicate her.
    assert removed(export)["JUDITH"] == {
        "action": "removed",
        "match": "alias",
        "entity_ids": "person:aholibamah_1761",
        "keep_row": "",
    }
    assert not (export / "data" / VERSION / "entity" / "theme" / "judith.json").exists()


def test_a_heading_with_another_form_in_brackets_is_matched_without_it(export):
    # "REBEKAH (REBECCA)" is Rebekah, as "Jacob (Israel)" is Jacob.
    assert removed(export)["REBEKAH (REBECCA)"] == {
        "action": "removed",
        "match": "name",
        "entity_ids": "person:rebekah_2401",
        "keep_row": "",
    }
    assert not (export / "data" / VERSION / "entity" / "theme" / "rebekah_rebecca.json").exists()


def test_a_heading_that_matches_only_a_part_before_a_comma_is_kept_and_reported(export):
    assert removed(export)["JESUS, THE CHRIST"] == {
        "action": "kept",
        "match": "part of the heading",
        "entity_ids": "person:jesus_905",
        "keep_row": "",
    }
    assert theme(export, "jesus_the_christ")["name"] == "JESUS, THE CHRIST"


def test_a_reviewed_keep_row_keeps_a_heading_that_names_a_person(export):
    # Fixture themes_keep.csv: GOD is reviewed; MASTER (an alias of Jesus) is not.
    rows = removed(export)
    assert rows["GOD"] == {
        "action": "kept",
        "match": "name",
        "entity_ids": "person:god_1324",
        "keep_row": "yes",
    }
    assert theme(export, "god")["name"] == "God (topic)"  # the keep row's display name
    assert rows["MASTER"] == {
        "action": "removed",
        "match": "alias",
        "entity_ids": "person:jesus_905",
        "keep_row": "",
    }
    unreviewed = read_tsv(export / "reports" / "curated_unreviewed.tsv")
    assert {"table": "themes_keep", "line": "3", "ids": "MASTER", "detail": "no"} in unreviewed


def test_a_heading_with_only_see_lines_is_not_a_theme(export):
    assert not (export / "data" / VERSION / "entity" / "theme" / "accountability.json").exists()


def test_whole_chapters_and_missing_verses_in_naves_are_reported(export):
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    # Synthetic: GEN 11:33 (Genesis 11 has 32 verses). Real: "Descendants of GEN 36", 3 Themes.
    assert {
        "verse": "Gen.11.33",
        "cause": "Nave's reference to a verse that is not in Theographic (dropped)",
        "count": "1",
    } in rows
    assert {
        "verse": "Gen.36",
        "cause": "Nave's reference to a whole chapter (skipped, decision 59)",
        "count": "3",
    } in rows
    assert "01036001" not in [v["key"] for v in theme(export, "edomites")["verses"]]


def test_a_theme_and_a_person_that_share_verses_have_a_co_mention(export):
    # Across the fixture's Bible, Birthright files 17 Verses and Esau is in 64; they share 6
    # (Gen 25:29, 30, 32, 34, Rom 9:13, Heb 12:16): 6 / sqrt(17 * 64). 4 are in the book range.
    esau = neighbour(export, "theme:birthright", "person:esau_1216")
    assert esau["weight"] == 0.1819
    assert esau["edges"] == [
        {
            "edge": "CO_MENTION",
            "direction": "both",
            "shared_verses": 4,
            "cosine": 0.1819,
            "source": "Nave's Topical Bible; Theographic",
            "licence": "CC BY 4.0; CC BY-SA 4.0",
        }
    ]
    # In Esau's file the Theme is weighted by rarity (decision 111): 6 x ln(31,102 / 17).
    assert neighbour(export, "person:esau_1216", "theme:birthright")["weight"] == 45.0709


def test_themes_are_in_the_search_index(export):
    index = search_index(export)
    assert search(index, "Birthright") == ["theme:birthright"]
    assert {"id": "theme:birthright", "type": "theme", "name": "BIRTHRIGHT", "aliases": []} in (
        index["entities"]
    )
