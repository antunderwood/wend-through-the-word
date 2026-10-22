from conftest import VERSION, chapter_verse, read_json, read_tsv


def entity(export, kind, name):
    return read_json(export / "data" / VERSION / "entity" / kind / f"{name}.json")


def test_each_entity_type_has_files_with_prefixed_ids(export):
    assert entity(export, "person", "abraham_58")["id"] == "person:abraham_58"
    assert entity(export, "place", "canaan_272")["id"] == "place:canaan_272"
    assert entity(export, "event", "53")["id"] == "event:53"
    assert entity(export, "group", "tribe_of_judah")["id"] == "group:tribe_of_judah"


def test_chapter_file_shows_the_entities_each_verse_mentions(export):
    mentions = chapter_verse(export, "Gen.25.7")["mentions"]
    assert [(m["id"], m["edge"]) for m in mentions] == [
        ("event:66", "MENTIONS"),
        ("event:88", "MENTIONS"),
        ("person:abraham_58", "MENTIONS"),
    ]
    assert all(m["source"] == "Theographic" and m["licence"] == "CC BY-SA 4.0" for m in mentions)
    assert "group:tribe_of_judah" in [
        m["id"] for m in chapter_verse(export, "Gen.36.1")["mentions"]
    ]
    assert chapter_verse(export, "3John.1.2")["mentions"] == []


def test_each_mention_and_filed_under_is_weighted_by_the_rarity_of_its_entity(export):
    # Decision 121: ln(31,102 / whole-Bible Verse count), rounded to 4 places. Fixture: Keturah is
    # in 4 Verses across the Bible and Abraham in 74, so in Gen 25:1 Keturah comes first.
    gen_25_1 = chapter_verse(export, "Gen.25.1")
    assert {m["id"]: m["weight"] for m in gen_25_1["mentions"]} == {
        "person:abraham_58": 6.041,
        "person:keturah_1782": 8.9587,
    }
    # The heading LENTILES is rarer than BIRTHRIGHT, so it outweighs it in Gen 25:34.
    filed = {m["id"]: m["weight"] for m in chapter_verse(export, "Gen.25.34")["filed_under"]}
    assert filed["theme:lentiles"] > filed["theme:birthright"]

    weights = {}  # an Entity has one weight in every Verse
    for path in (export / "data" / VERSION / "chapter").rglob("*.json"):
        for v in read_json(path).get("verses", []):  # a Ring 2 sidecar has none
            for m in v["mentions"] + v["filed_under"]:
                assert m["weight"] > 0 and round(m["weight"], 4) == m["weight"]
                weights.setdefault(m["id"], set()).add(m["weight"])
    assert all(len(w) == 1 for w in weights.values())


def test_each_person_has_a_gender_and_no_year(export):
    people = list((export / "data" / VERSION / "entity" / "person").glob("*.json"))
    assert people
    for path in people:
        person = read_json(path)
        assert person["gender"] in ("Male", "Female")
        assert not any("year" in k for k in person)
    assert entity(export, "person", "hagar_1348")["gender"] == "Female"


def test_people_with_the_same_name_stay_separate_entities(export):
    anahs = [entity(export, "person", n) for n in ("anah_247", "anah_248", "anah_249")]
    assert [(a["id"], a["name"]) for a in anahs] == [
        ("person:anah_247", "Anah"),
        ("person:anah_248", "Anah"),
        ("person:anah_249", "Anah"),
    ]


def test_event_year_is_the_astronomical_year_from_theographic(export):
    assert entity(export, "event", "53")["event_year"] == -2245  # Tower of Babel, 2246 BC
    assert entity(export, "event", "407")["event_year"] == 29  # Healing a Boy with a Demon, AD 29


def test_entity_files_hold_the_names_the_detail_panel_shows(export):
    jacob = entity(export, "person", "israel_682")
    assert (jacob["name"], jacob["aliases"]) == ("Jacob (Israel)", ["Israel"])
    assert entity(export, "person", "abraham_58")["aliases"] == ["Abram"]
    assert entity(export, "place", "canaan_272")["name"] == "Canaan"
    assert entity(export, "event", "53")["title"] == "Tower of Babel"
    assert entity(export, "group", "tribe_of_judah")["name"] == "Tribe of Judah"


def test_dictionary_entry_comes_from_dict_text_labelled_as_eastons(export):
    entry = entity(export, "person", "abraham_58")["dictionary_entry"]
    assert entry["text"].startswith(
        "Father of a multitude, son of Terah, named (Gen. 11:27) before"
    )
    assert entry["source"] == "Easton's Bible Dictionary (1897)"
    assert entry["licence"] == "Public domain (1897)"
    assert "dictionary_entry" in entity(export, "place", "canaan_272")


def test_dictionary_entry_is_never_taken_from_dictionary_text(export):
    # The fixture removes Demetrius's dictText and keeps his dictionaryText.
    assert "dictionary_entry" not in entity(export, "person", "demetrius_1007")


def test_verse_neighbours_rank_by_other_entities_in_the_verse_then_by_key(export):
    verses = entity(export, "person", "hagar_1348")["verses"]
    # Themes count too: Gen 16:3 mentions Hagar and 4 other Entities, and is filed under 2 Themes.
    assert [(v["key"], v["weight"]) for v in verses] == [
        ("01016003", 6),
        ("01016008", 6),
        ("01016015", 4),
        ("01016016", 4),
        ("01025012", 4),
        ("01016001", 3),
        ("01016004", 0),
    ]
    assert {(v["edge"], v["direction"], v["source"]) for v in verses} == {
        ("MENTIONS", "in", "Theographic")
    }


def test_mention_of_a_verse_with_no_key_is_reported_with_count_and_cause(export):
    # The fixture adds a verse record ID that is not in verses.json to Abraham's verses.
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    assert {
        "verse": "recFixtureNoVerse",
        "cause": "Theographic mention of a verse record that does not exist (dropped)",
        "count": "1",
    } in rows
