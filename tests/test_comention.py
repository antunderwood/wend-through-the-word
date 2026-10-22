from conftest import (
    VERSION,
    entity,
    neighbour,
    read_json,
    read_tsv,
    top_people,
)


def entity_files(export):
    return [read_json(p) for p in (export / "data" / VERSION / "entity").rglob("*.json")]


def co_mention(n):
    return next((e for e in n["edges"] if e["edge"] == "CO_MENTION"), None)


def by_cosine(e):
    """An Entity's Neighbours as Ring 2 entries, ranked on their CO_MENTION cosine (decision 111)."""
    cos = [
        {"id": n["id"], "weight": (co_mention(n) or {}).get("cosine", 0)} for n in e["neighbours"]
    ]
    return sorted(cos, key=lambda n: (-n["weight"], n["id"]))


def ring1(e):
    """The top 6 Neighbours of each type: Entity IDs, then Verse Keys."""
    by_type = {}
    for n in e["neighbours"]:
        by_type.setdefault(n["type"], []).append(n["id"])
    return {i for ids in by_type.values() for i in ids[:6]} | {v["key"] for v in e["verses"][:6]}


def test_every_pair_of_entities_sharing_a_verse_in_range_has_one_co_mention(export):
    files = entity_files(export)
    verses = {e["id"]: {v["key"] for v in e["verses"]} for e in files}
    for e in files:
        found = {n["id"]: co_mention(n) for n in e["neighbours"] if co_mention(n)}
        expected = {
            other: len(verses[e["id"]] & keys)
            for other, keys in verses.items()
            if other != e["id"] and verses[e["id"]] & keys
        }
        assert {other: c["shared_verses"] for other, c in found.items()} == expected


def test_co_mention_weight_is_the_cosine_score_over_whole_bible_verse_sets(export):
    # Fixture: across the Bible, Abraham is in 74 Verses and Isaac in 57, and they share 33:
    # 33 / sqrt(74 * 57). Only 7 of the 33 are in the book range.
    isaac = neighbour(export, "person:abraham_58", "person:isaac_616")
    assert isaac["weight"] == 0.5081
    assert co_mention(isaac) == {
        "edge": "CO_MENTION",
        "direction": "both",
        "shared_verses": 7,
        "cosine": 0.5081,
        "source": "Theographic",
        "licence": "CC BY-SA 4.0",
    }
    assert neighbour(export, "person:isaac_616", "person:abraham_58")["weight"] == 0.5081


def test_co_mention_source_and_licence_come_from_the_shared_verses_links_only(export):
    chapters = (export / "data" / VERSION / "chapter").rglob("*.json")
    links = {}  # (Verse Key, Entity ID) -> (source, licence) of the Mention or Filed Under
    for p in chapters:
        for v in read_json(p).get("verses", []):
            for m in v["mentions"] + v["filed_under"]:
                links[v["key"], m["id"]] = (m["source"], m["licence"])
    for e in entity_files(export):
        verses = {v["key"] for v in e["verses"]}
        for n in e["neighbours"]:
            if not (c := co_mention(n)):
                continue
            shared = {k for k, i in links if i == n["id"]} & verses
            found = {links[k, i] for k in shared for i in (e["id"], n["id"])}
            sources = "; ".join(sorted({s for s, _ in found}))
            licences = "; ".join(sorted({lic for _, lic in found}))
            assert (c["source"], c["licence"]) == (sources, licences), (e["id"], n["id"])


def test_a_hub_that_shares_many_verses_is_not_a_top_neighbour(export):
    # Fixture: God is in 632 Verses and shares 24 with Abraham, more than anyone but Isaac.
    god = neighbour(export, "person:abraham_58", "person:god_1324")
    assert (god["weight"], co_mention(god)["shared_verses"]) == (0.111, 4)
    assert "person:god_1324" not in top_people(entity(export, "person:abraham_58"))
    # Esau is in all 6 of Adah's Verses; Eliphaz is in 4.
    adah = [n for n in entity(export, "person:adah_414")["neighbours"] if n["type"] == "person"]
    esau = neighbour(export, "person:adah_414", "person:esau_1216")
    assert co_mention(esau)["shared_verses"] == 6
    assert (adah[0]["id"], adah[0]["weight"]) == ("person:eliphaz_1144", 0.5774)


def test_neighbours_rank_by_weight_alone_and_an_explicit_edge_gives_no_priority(export):
    for e in entity_files(export):
        ranked = [(-n["weight"], n["id"]) for n in e["neighbours"]]
        assert ranked == sorted(ranked), e["id"]
    abraham = [n["id"] for n in entity(export, "person:abraham_58")["neighbours"]]
    # Abraham's son Zimran shares no fixture Verse with him (weight 0); Lot shares 2.
    assert neighbour(export, "person:abraham_58", "person:zimran_3086")["weight"] == 0
    assert neighbour(export, "person:abraham_58", "person:lot_1830")["edges"] == [
        co_mention(neighbour(export, "person:abraham_58", "person:lot_1830"))
    ]
    assert abraham.index("person:lot_1830") < abraham.index("person:zimran_3086")


def test_a_pair_with_an_explicit_edge_and_a_co_mention_is_one_neighbour(export):
    for e in entity_files(export):
        ids = [n["id"] for n in e["neighbours"]]
        assert len(ids) == len(set(ids)), e["id"]
    sarah = neighbour(export, "person:abraham_58", "person:sarah_2473")
    assert [(i["edge"], i["direction"]) for i in sarah["edges"]] == [
        ("CO_MENTION", "both"),
        ("SPOUSE_OF", "both"),  # curated (#7)
    ]


def test_each_entity_file_counts_the_overflow_of_each_type_at_k_6(export):
    for e in entity_files(export):
        types = [n["type"] for n in e["neighbours"]] + ["verse"] * len(e["verses"])
        assert e["overflow"] == {t: max(0, types.count(t) - 6) for t in set(types)}, e["id"]
    # Fixture: Abraham is in 29 Verses in the book range, so 23 of them are Overflow.
    assert entity(export, "person:abraham_58")["overflow"]["verse"] == 23


def test_each_entity_file_holds_the_top_10_neighbours_of_each_ring_1_node(export):
    files = {e["id"]: e for e in entity_files(export)}
    chapters = (export / "data" / VERSION / "chapter").rglob("*.json")
    verses = {
        v["key"]: v for p in chapters if "ring2" not in p.name for v in read_json(p)["verses"]
    }
    for e in files.values():
        assert e["ring2"].keys() == ring1(e), e["id"]
        for node, top in e["ring2"].items():
            # An Entity's Ring 2 is its top Entity Neighbours; a Verse's is its cross-references.
            # Entity Neighbours are ranked on their CO_MENTION cosine, one scale for every type.
            if node in files:
                assert top == by_cosine(files[node])[:10]
            else:
                ranked = verses[node]["cross_references"]
                assert top == [{"id": n["id"], "weight": n["weight"]} for n in ranked[:10]]
    abraham = entity(export, "person:abraham_58")
    assert abraham["ring2"]["person:isaac_616"][0] == {"id": "person:abraham_58", "weight": 0.5081}


def test_chapter_ring2_sidecar_holds_the_top_10_neighbours_of_each_entity_in_the_chapter(export):
    files = {e["id"]: e for e in entity_files(export)}
    for path in (export / "data" / VERSION / "chapter").rglob("*.ring2.json"):
        verses = read_json(path.with_name(path.name.replace(".ring2", "")))["verses"]
        sidecar = read_json(path)
        mentioned = {m["id"] for v in verses for m in v["mentions"] + v["filed_under"]}
        assert mentioned <= sidecar["ring2"].keys(), path.name
        for node in mentioned:
            assert sidecar["ring2"][node] == by_cosine(files[node])[:10]
    gen11 = read_json(export / "data" / VERSION / "chapter" / "Gen" / "11.ring2.json")
    # Cross-references come from OpenBible.info; Entity Neighbours from Theographic, Nave's
    # (Co-mentions with Themes), and the curated tables (Abraham and Sarah's SPOUSE_OF).
    assert (gen11["source"], gen11["licence"]) == (
        "Curated; Nave's Topical Bible; OpenBible.info; Theographic",
        "CC BY 4.0; CC BY-SA 4.0",
    )


def test_trimming_an_oversized_ring2_sidecar_keeps_every_entity_entry(
    genesis_export, trimmed_export
):
    small = trimmed_export  # Gen 36 Ring 2 is about 50 KB
    path = f"data/{VERSION}/chapter/Gen/36.ring2.json"
    rows = read_tsv(small / "reports" / "split_or_trimmed.tsv")
    assert [r["action"] for r in rows if r["path"] == path] == ["trimmed"]

    def entities(out):
        return {k: v for k, v in read_json(out / path)["ring2"].items() if ":" in k}

    assert entities(small) == entities(genesis_export)


def test_a_theme_neighbour_is_weighted_by_shared_verses_times_the_rarity_of_the_heading(export):
    # Decision 111. Fixture: across the Bible, Abraham shares 10 Verses with GENEALOGY (61 Verses
    # under the heading) and 3 with BASTARD (3 Verses). Weight = shared x ln(31,102 / heading).
    # Cosine would rank BASTARD (0.2013) above GENEALOGY (0.1488); this ranks the broad topic first.
    genealogy = neighbour(export, "person:abraham_58", "theme:genealogy")
    bastard = neighbour(export, "person:abraham_58", "theme:bastard")
    assert (genealogy["weight"], bastard["weight"]) == (62.3415, 27.7392)
    themes = [
        n["id"] for n in entity(export, "person:abraham_58")["neighbours"] if n["type"] == "theme"
    ]
    assert themes.index("theme:genealogy") < themes.index("theme:bastard")
    # A Person in a Theme's list keeps the cosine score.
    assert neighbour(export, "theme:genealogy", "person:abraham_58")["weight"] == 0.1488
