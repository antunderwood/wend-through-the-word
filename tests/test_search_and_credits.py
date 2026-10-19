import gzip

from conftest import VERSION, read_json


def search_index(export):
    return read_json(export / "data" / VERSION / "search-index.json")


def compressed_size(export):
    return len(gzip.compress((export / "data" / VERSION / "search-index.json").read_bytes()))


def search(index, text):
    """What the front end does: match names and aliases (PRD 11, search box)."""
    text = text.lower()
    return [
        e["id"]
        for e in index["entities"]
        if text in (n.lower() for n in [e["name"], *e["aliases"]])
    ]


def test_a_search_for_abraham_returns_abraham(export):
    assert search(search_index(export), "Abraham") == ["person:abraham_58"]


def test_aliases_from_theographic_are_searchable(export):
    index = search_index(export)
    assert search(index, "Abram") == ["person:abraham_58"]
    assert "person:israel_682" in search(index, "Israel")  # Jacob, alsoCalled "Israel"


def test_place_aliases_and_kjv_names_are_searchable(export):
    index = search_index(export)
    assert search(index, "Promised Land") == ["place:canaan_272"]  # aliases
    assert search(index, "Ur") == ["place:ur_1189"]  # kjvName; the name is "Ur of the Chaldees"
    gerar = next(e for e in index["entities"] if e["id"] == "place:valley_of_gerar_1203")
    assert gerar["aliases"] == []  # kjvName "valley of Gerar" differs only in case


def test_index_lists_each_entity_with_its_type_and_label(export):
    entities = {e["id"]: e for e in search_index(export)["entities"]}
    assert entities["event:53"] == {
        "id": "event:53",
        "type": "event",
        "name": "Tower of Babel",
        "aliases": [],
    }
    assert entities["group:tribe_of_judah"]["type"] == "group"
    assert entities["person:israel_682"]["name"] == "Jacob (Israel)"


def test_every_entity_file_has_a_label_in_the_index(export):
    # Any Entity type, including ones later steps add, so Ring 2 IDs always have a label.
    files = (export / "data" / VERSION / "entity").glob("*/*.json")
    labels = {e["id"]: e["name"] for e in search_index(export)["entities"]}
    ids = [read_json(p)["id"] for p in files]
    assert ids and sorted(ids) == sorted(labels)
    assert all(labels.values())


def test_search_index_is_below_500_kb_compressed(export):
    assert compressed_size(export) < 500 * 1000


def credits(export):
    return read_json(export / "data" / VERSION / "credits.json")


def test_credits_list_every_source_the_build_read_and_no_other(export):
    shipped = read_json(export / "data" / "index.json")["sources"]
    entries = credits(export)["sources"]
    # TIPNR is read for the check only, so it is credited but not listed as shipped data.
    assert sorted(f for e in entries for f in e["files"]) == sorted([*shipped, "tipnr"])
    assert all(e["name"] and e["licence"] and e["link"].startswith("https://") for e in entries)
    theographic = next(e for e in entries if e["name"] == "Theographic Bible Metadata")
    assert theographic["licence"] == "CC BY-SA 4.0"
    assert theographic["licence_link"] == "https://creativecommons.org/licenses/by-sa/4.0/"


def test_tipnr_is_credited_as_a_check_and_not_listed_as_shipped_data(export):
    # Decision 46: nothing from TIPNR ships, so index.json does not list it as a source.
    assert "tipnr" not in read_json(export / "data" / "index.json")["sources"]
    tipnr = [e for e in credits(export)["sources"] if "tipnr" in e["files"]]
    assert tipnr[0]["credit"] == "Used to check the data; nothing from it is included."


def test_credits_say_the_data_is_modified_and_link_the_curated_tables_and_bibliography(export):
    c = credits(export)
    assert "modified" in c["modified"]
    assert c["curated_tables"].endswith("/pipeline/curated")
    theographic = next(e for e in c["sources"] if e["name"] == "Theographic Bible Metadata")
    assert theographic["bibliography"].endswith("/docs/data-source-bibliography.md")


def test_eastons_is_credited_when_a_dictionary_entry_ships(export):
    eastons = next(e for e in credits(export)["sources"] if e["name"].startswith("Easton"))
    assert eastons["licence"] == "Public domain (1897)"


def test_index_lists_every_book_so_any_verse_key_can_be_labelled(export):
    # Stories 44 and 69: a cross-reference can point outside the book range (Zeph.3.9 is
    # 36003009), so the index names all 66 books by the BB of the Verse Key.
    books = search_index(export)["books"]
    assert len(books) == 66
    assert books[0] == {
        "number": "01",
        "osis": "Gen",
        "name": "Genesis",
        "chapters": [11, 16, 25, 26, 36],
    }
    assert {"number": "36", "osis": "Zeph", "name": "Zephaniah", "chapters": []} in books
    # The chapter list stays limited to the book range.
    assert [(b["osis"], b["name"]) for b in books if b["chapters"]] == [
        ("Gen", "Genesis"),
        ("Matt", "Matthew"),
        ("3John", "3 John"),
    ]
    assert [b["number"] for b in books] == [f"{n:02}" for n in range(1, 67)]
