import gzip

from conftest import VERSION, read_json, read_tsv


def verse(export, book, ch, vs):
    verses = read_json(export / "data" / VERSION / "chapter" / book / f"{ch}.json")["verses"]
    return next(v for v in verses if v["verse"] == vs)


def edges(neighbours):
    """(Neighbour ID, direction, Votes, to_end_key) for each edge of each Neighbour."""
    return [
        (n["id"], e["direction"], e["votes"], e.get("to_end_key"))
        for n in neighbours
        for e in n["edges"]
    ]


def test_chapter_file_lists_the_cross_referenced_verses_of_each_verse_by_votes(export):
    refs = verse(export, "Gen", 11, 1)["cross_references"]
    # Fixture rows: Gen.11.1 to Zeph.3.9 (16) and back (11), to Acts.2.6 (16), to Isa.19.18 (3)
    # and back (1), and Gen.11.6 to Gen.11.1 (8).
    assert [(n["id"], n["type"], n["weight"]) for n in refs] == [
        ("36003009", "verse", 16),  # Zeph.3.9
        ("44002006", "verse", 16),  # Acts.2.6
        ("01011006", "verse", 8),  # Gen.11.6
        ("23019018", "verse", 3),  # Isa.19.18
    ]
    assert edges(refs[:1]) == [("36003009", "out", 16, None), ("36003009", "in", 11, None)]
    assert edges(refs[3:]) == [("23019018", "out", 3, None), ("23019018", "in", 1, None)]
    edge = refs[0]["edges"][0]
    assert (edge["edge"], edge["source"], edge["licence"]) == (
        "CROSS_REF",
        "OpenBible.info",
        "CC BY 4.0",
    )


def test_no_verse_lists_a_cross_referenced_verse_twice(export):
    for path in (export / "data" / VERSION / "chapter").glob("*/*.json"):
        for v in read_json(path).get("verses", []):
            ids = [n["id"] for n in v["cross_references"]]
            assert len(ids) == len(set(ids)), (path.name, v["label"])


def test_a_cross_reference_to_a_range_is_one_edge_to_its_first_verse_with_the_end_key(export):
    # OpenBible row: 3John.1.2  3John.1.3-3John.1.6  9 (decision 52)
    out = edges(verse(export, "3John", 1, 2)["cross_references"])
    assert ("64001003", "out", 9, "64001006") in out
    into = edges(verse(export, "3John", 1, 3)["cross_references"])
    assert ("64001002", "in", 9, "64001006") in into
    for v in (4, 5, 6):
        assert "64001002" not in [n["id"] for n in verse(export, "3John", 1, v)["cross_references"]]


def test_a_genesis_verse_links_to_verses_outside_the_book_range(export):
    ids = {n["id"] for n in verse(export, "Gen", 11, 1)["cross_references"]}
    assert {
        "44002006",
        "36003009",
    } <= ids  # Acts.2.6, Zeph.3.9; the range is Gen, Matt, John, 3John


def test_a_cross_reference_to_3john_1_15_arrives_at_3john_1_14(export):
    # Fixture row: Matt.17.20 to 3John.1.15 (synthetic, 3 votes)
    found = edges(verse(export, "3John", 1, 14)["cross_references"])
    assert ("40017020", "in", 3, None) in found
    matt = edges(verse(export, "Matt", 17, 20)["cross_references"])
    assert ("64001014", "out", 3, None) in matt


def test_a_cross_reference_with_no_verse_key_is_in_the_verse_mismatch_report(export):
    # Fixture row (synthetic): Gen.11.1 to Gen.11.33; Genesis 11 has 32 verses
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    cause = "OpenBible cross-reference with no Verse Key (dropped)"
    assert {"verse": "Gen.11.33", "cause": cause, "count": "1"} in rows


def test_chapter_ring2_sidecar_holds_the_top_10_neighbours_of_each_ring1_verse(export):
    chapter = export / "data" / VERSION / "chapter" / "Gen"
    ring2 = read_json(chapter / "11.ring2.json")["ring2"]
    # Gen.11.6 is in Ring 1 of Gen.11.1. Its fixture rows, by Votes; a range counts at its first
    # verse only, so Eccl.7.29 to Gen.11.4-Gen.11.6 is not here. 1Kgs.18.27 (0) is below the
    # top 10. John is a fixture book, so the row to John.1.10, outside the fixture, is cut.
    assert ring2["01011006"] == [
        {"id": "19002001", "weight": 13},  # Ps.2.1-Ps.2.4
        {"id": "01011001", "weight": 8},
        {"id": "21011009", "weight": 6},  # Eccl.11.9
        {"id": "42001051", "weight": 6},  # Luke.1.51
        {"id": "35002013", "weight": 4},  # Hab.2.13
        {"id": "27004009", "weight": 2},  # Dan.4.9
        {"id": "44002003", "weight": 2},  # Acts.2.3
        {"id": "44014018", "weight": 2},  # Acts.14.18
        {"id": "44017026", "weight": 2},  # Acts.17.26
        {"id": "07010014", "weight": 1},  # Judg.10.14
    ]
    ring1 = read_json(chapter / "11.json")["verses"]
    verse_keys = {k for k in ring2 if ":" not in k}  # the rest are Entities (decision 96)
    assert {n["id"] for v in ring1 for n in v["cross_references"]} == verse_keys
    assert all(e.keys() == {"id", "weight"} for entries in ring2.values() for e in entries)


def test_an_oversized_chapter_file_loses_its_lowest_vote_cross_references_and_is_reported(
    untrimmed_export, trimmed_export, trim_limit
):
    small = trimmed_export
    path = f"data/{VERSION}/chapter/Gen/25.json"
    assert len(gzip.compress((small / path).read_bytes(), 9)) < trim_limit

    def neighbours(out):
        verses = read_json(out / path)["verses"]
        return {(v["key"], n["id"], n["weight"]) for v in verses for n in v["cross_references"]}

    kept, dropped = neighbours(small), neighbours(untrimmed_export) - neighbours(small)
    assert kept and dropped
    assert min(e[2] for e in kept) >= max(e[2] for e in dropped)
    rows = read_tsv(small / "reports" / "split_or_trimmed.tsv")
    assert [(r["action"], r["dropped"]) for r in rows if r["path"] == path] == [
        ("trimmed", str(len(dropped)))
    ]


def test_an_oversized_ring2_file_loses_its_lowest_weights_and_is_reported(
    untrimmed_export, trimmed_export, trim_limit
):
    small = trimmed_export
    path = f"data/{VERSION}/chapter/Gen/25.ring2.json"
    assert len(gzip.compress((small / path).read_bytes(), 9)) < trim_limit
    # Compare only the Verses' entries: Entity entries are never trimmed (decision 96).
    nodes = {k for k in read_json(small / path)["ring2"] if ":" not in k}

    def entries(out):
        ring2 = read_json(out / path)["ring2"]
        return {(node, e["id"], e["weight"]) for node in nodes for e in ring2[node]}

    kept, dropped = entries(small), entries(untrimmed_export) - entries(small)
    assert dropped
    assert min(e[2] for e in kept) >= max(e[2] for e in dropped)
    rows = read_tsv(small / "reports" / "split_or_trimmed.tsv")
    assert [r["action"] for r in rows if r["path"] == path] == ["trimmed"]
