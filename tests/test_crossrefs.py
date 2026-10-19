from conftest import VERSION, read_json, read_tsv, run_build


def verse(export, book, ch, vs):
    verses = read_json(export / "data" / VERSION / "chapter" / book / f"{ch}.json")["verses"]
    return next(v for v in verses if v["verse"] == vs)


def test_chapter_file_lists_the_cross_references_of_each_verse_by_votes(export):
    refs = verse(export, "Gen", 11, 1)["cross_references"]
    assert [(r["key"], r["direction"], r["weight"]) for r in refs] == [
        ("36003009", "out", 16),  # Zeph.3.9
        ("44002006", "out", 16),  # Acts.2.6
        ("36003009", "in", 11),
        ("01011006", "in", 8),  # Gen.11.6
        ("23019018", "out", 3),  # Isa.19.18
        ("23019018", "in", 1),
    ]
    assert refs[0]["edge"] == "CROSS_REF"
    assert (refs[0]["source"], refs[0]["licence"]) == ("OpenBible.info", "CC BY 4.0")


def test_a_cross_reference_to_a_range_is_one_edge_to_its_first_verse_with_the_end_key(export):
    # OpenBible row: 3John.1.2  3John.1.3-3John.1.6  9 (decision 52)
    out = [r for r in verse(export, "3John", 1, 2)["cross_references"] if r["key"] == "64001003"]
    assert [(r["direction"], r["weight"], r["to_end_key"]) for r in out] == [("out", 9, "64001006")]
    into = [r for r in verse(export, "3John", 1, 3)["cross_references"] if r["key"] == "64001002"]
    assert [(r["direction"], r["weight"], r["to_end_key"]) for r in into] == [("in", 9, "64001006")]
    for v in (4, 5, 6):
        assert "64001002" not in [
            r["key"] for r in verse(export, "3John", 1, v)["cross_references"]
        ]


def test_a_genesis_verse_links_to_verses_outside_the_book_range(export):
    keys = {r["key"] for r in verse(export, "Gen", 11, 1)["cross_references"]}
    assert {"44002006", "36003009"} <= keys  # Acts.2.6, Zeph.3.9; the range is Gen, Matt, 3John


def test_a_cross_reference_to_3john_1_15_arrives_at_3john_1_14(export):
    # Fixture rows: Matt.17.20 to 3John.1.15 (synthetic, 3 votes), 3John.1.15 to John.10.3 (2)
    refs = verse(export, "3John", 1, 14)["cross_references"]
    edges = {(r["key"], r["direction"], r["weight"]) for r in refs}
    assert {("40017020", "in", 3), ("43010003", "out", 2)} <= edges
    matt = verse(export, "Matt", 17, 20)["cross_references"]
    assert ("64001014", "out", 3) in [(r["key"], r["direction"], r["weight"]) for r in matt]


def test_a_cross_reference_with_no_verse_key_is_in_the_verse_mismatch_report(export):
    # Fixture row (synthetic): Gen.11.1 to Gen.11.33; Genesis 11 has 32 verses
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    cause = "OpenBible cross-reference with no Verse Key (dropped)"
    assert {"verse": "Gen.11.33", "cause": cause, "count": "1"} in rows


def test_chapter_ring2_sidecar_holds_the_top_10_neighbours_of_each_ring1_verse(export):
    chapter = export / "data" / VERSION / "chapter" / "Gen"
    ring2 = read_json(chapter / "11.ring2.json")["ring2"]
    # Gen.11.6 is in Ring 1 of Gen.11.1. Its fixture rows, by Votes; a range counts at its first
    # verse only, so Eccl.7.29 to Gen.11.4-Gen.11.6 is not here. Judg.10.14 (1) and 1Kgs.18.27
    # (0) are below the top 10.
    assert ring2["01011006"] == [
        {"id": "19002001", "weight": 13},  # Ps.2.1-Ps.2.4
        {"id": "01011001", "weight": 8},
        {"id": "21011009", "weight": 6},  # Eccl.11.9
        {"id": "42001051", "weight": 6},  # Luke.1.51
        {"id": "35002013", "weight": 4},  # Hab.2.13
        {"id": "43001010", "weight": 4},  # John.1.10
        {"id": "27004009", "weight": 2},  # Dan.4.9
        {"id": "44002003", "weight": 2},  # Acts.2.3
        {"id": "44014018", "weight": 2},  # Acts.14.18
        {"id": "44017026", "weight": 2},  # Acts.17.26
    ]
    ring1 = read_json(chapter / "11.json")["verses"]
    assert {r["key"] for v in ring1 for r in v["cross_references"]} == ring2.keys()
    assert all(e.keys() == {"id", "weight"} for entries in ring2.values() for e in entries)


def test_an_oversized_chapter_file_loses_its_lowest_vote_cross_references_and_is_reported(
    export, tmp_path
):
    limit = 45000  # Gen 25 is about 79 KB in the fixture build
    small = run_build(tmp_path / "out", size_limit=limit)
    path = f"data/{VERSION}/chapter/Gen/25.json"
    assert (small / path).stat().st_size < limit

    def edges(out):
        verses = read_json(out / path)["verses"]
        return {
            (v["key"], r["key"], r["direction"], r["weight"])
            for v in verses
            for r in v["cross_references"]
        }

    kept, dropped = edges(small), edges(export) - edges(small)
    assert kept and dropped
    assert min(e[3] for e in kept) >= max(e[3] for e in dropped)
    rows = read_tsv(small / "reports" / "split_or_trimmed.tsv")
    assert [(r["action"], r["dropped"]) for r in rows if r["path"] == path] == [
        ("trimmed", str(len(dropped)))
    ]


def test_an_oversized_ring2_file_loses_its_lowest_weights_and_is_reported(export, tmp_path):
    limit = 15000  # Gen 25 Ring 2 is about 28 KB in the fixture build
    small = run_build(tmp_path / "out", size_limit=limit)
    path = f"data/{VERSION}/chapter/Gen/25.ring2.json"
    assert (small / path).stat().st_size < limit

    def entries(out):
        ring2 = read_json(out / path)["ring2"]
        return {(node, e["id"], e["weight"]) for node, top in ring2.items() for e in top}

    kept, dropped = entries(small), entries(export) - entries(small)
    assert min(e[2] for e in kept) >= max(e[2] for e in dropped)
    rows = read_tsv(small / "reports" / "split_or_trimmed.tsv")
    assert [r["action"] for r in rows if r["path"] == path] == ["trimmed"]
