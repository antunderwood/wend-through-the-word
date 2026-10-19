from conftest import VERSION, nodes_and_edges, read_json, read_tsv, run_build

LIMIT = 500 * 1000


def chapter(export, book, ch):
    return read_json(export / "data" / VERSION / "chapter" / book / f"{ch}.json")


def test_index_holds_books_counts_date_version_and_licences(export):
    index = read_json(export / "data" / "index.json")
    assert index["build_date"] == "2026-10-19"
    assert index["data_version"] == VERSION
    assert index["licence"] == "CC BY-SA 4.0"
    assert index["sources"]["bsb"] == "CC0 1.0"
    assert [b["osis"] for b in index["books"]] == ["Gen", "Matt", "3John"]
    gen = index["books"][0]
    assert (gen["name"], gen["chapters"], gen["verses"]) == ("Genesis", 5, 160)
    assert index["counts"] == {"chapters": 7, "verses": 177}


def test_chapter_file_holds_each_verse_with_key_label_and_text(export):
    verses = chapter(export, "Gen", 16)["verses"]
    assert len(verses) == 16
    first = verses[0]
    assert (first["key"], first["label"], first["chapter"], first["verse"]) == (
        "01016001",
        "Gen.16.1",
        16,
        1,
    )
    assert first["text_bsb"].startswith("Now Abram’s wife Sarai had borne him no children")


def test_every_data_file_except_index_is_under_the_data_version(export):
    files = [p.relative_to(export / "data") for p in (export / "data").rglob("*.json")]
    assert all(p.parts[0] == VERSION for p in files if p.name != "index.json")


def test_verse_with_no_bsb_text_is_kept_and_marked(export):
    v21 = next(v for v in chapter(export, "Matt", 17)["verses"] if v["verse"] == 21)
    assert v21["no_bsb_text"] is True
    assert v21["text_bsb"] is None


def test_bsb_verse_with_no_theographic_key_is_reported(export):
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    assert {
        "verse": "3John.1.15",
        "cause": "BSB verse with no Theographic verse key (dropped)",
        "count": "1",
    } in rows
    assert all(v["verse"] <= 14 for v in chapter(export, "3John", 1)["verses"])


def test_every_node_and_edge_has_source_and_licence(export):
    for path in (export / "data").rglob("*.json"):
        if path.name == "search-index.json":
            continue  # labels only; each node's source and licence are in its entity file
        for item in nodes_and_edges(read_json(path)):
            assert item.get("source") and item.get("licence"), (path.name, item)


def test_every_file_is_below_the_size_limit_and_reported(export):
    rows = read_tsv(export / "reports" / "files.tsv")
    files = list((export / "data").rglob("*.json"))
    assert len(rows) == len(files)
    assert all(p.stat().st_size < LIMIT for p in files)


def test_two_builds_are_byte_identical(export, tmp_path):
    again = run_build(tmp_path / "out")
    first = {p.relative_to(export): p.read_bytes() for p in export.rglob("*") if p.is_file()}
    second = {p.relative_to(again): p.read_bytes() for p in again.rglob("*") if p.is_file()}
    assert first == second
