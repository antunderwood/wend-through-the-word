from conftest import VERSION, read_json
from test_edges import entity, neighbour


def entity_files(export):
    return [read_json(p) for p in (export / "data" / VERSION / "entity").rglob("*.json")]


def co_mention(n):
    return next((e for e in n["edges"] if e["edge"] == "CO_MENTION"), None)


def test_every_pair_of_entities_sharing_a_verse_has_one_co_mention(export):
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


def test_co_mention_weight_is_the_cosine_score(export):
    # Fixture: Abraham is in 26 Verses, Sarah in 11, and they share 9: 9 / sqrt(26 * 11).
    sarah = neighbour(export, "person:abraham_58", "person:sarah_2473")
    assert sarah["weight"] == 0.5322
    assert co_mention(sarah) == {
        "edge": "CO_MENTION",
        "direction": "both",
        "shared_verses": 9,
        "source": "Theographic",
        "licence": "CC BY-SA 4.0",
    }
    assert neighbour(export, "person:sarah_2473", "person:abraham_58")["weight"] == 0.5322


def test_a_hub_that_shares_the_most_verses_is_not_the_top_neighbour(export):
    # Fixture: Esau is in 30 Verses, the most of any Entity, and in all 6 of Adah's. Abraham is
    # in 26, and shares 6 of Isaac's 24, more than anyone. Cosine demotes both hubs.
    adah = entity(export, "person:adah_414")["neighbours"]
    assert co_mention(adah[0])["shared_verses"] == 4
    assert (adah[0]["id"], adah[0]["weight"]) == ("person:eliphaz_1144", 0.6667)
    isaac = entity(export, "person:isaac_616")["neighbours"]
    assert (isaac[0]["id"], isaac[0]["weight"]) == ("person:rebekah_2401", 0.4167)
    assert neighbour(export, "person:isaac_616", "person:abraham_58")["weight"] == 0.2402


def test_explicit_edges_rank_before_co_mention_whatever_the_weights(export):
    for e in entity_files(export):
        only_co_mention = [
            all(i["edge"] == "CO_MENTION" for i in n["edges"]) for n in e["neighbours"]
        ]
        assert only_co_mention == sorted(only_co_mention), e["id"]
    abraham = [n["id"] for n in entity(export, "person:abraham_58")["neighbours"]]
    # Abraham's son Zimran shares no fixture Verse with him (weight 0); Lot shares 2.
    assert neighbour(export, "person:abraham_58", "person:zimran_3086")["weight"] == 0
    assert neighbour(export, "person:abraham_58", "person:lot_1830")["weight"] == 0.2774
    assert abraham.index("person:zimran_3086") < abraham.index("person:lot_1830")


def test_a_pair_with_an_explicit_edge_and_a_co_mention_is_one_neighbour(export):
    for e in entity_files(export):
        ids = [n["id"] for n in e["neighbours"]]
        assert len(ids) == len(set(ids)), e["id"]
    sarah = neighbour(export, "person:abraham_58", "person:sarah_2473")
    assert [(i["edge"], i["direction"]) for i in sarah["edges"]] == [
        ("CO_MENTION", "both"),
        ("PARTNER_OF", "both"),
    ]


def test_each_entity_file_counts_the_overflow_of_each_type_at_k_6(export):
    for e in entity_files(export):
        types = [n["type"] for n in e["neighbours"]] + ["verse"] * len(e["verses"])
        assert e["overflow"] == {t: max(0, types.count(t) - 6) for t in set(types)}, e["id"]
    # Fixture: Abraham is in 26 Verses, so 20 of them are Overflow.
    assert entity(export, "person:abraham_58")["overflow"]["verse"] == 20


def ring1(e):
    """The top 6 Neighbours of each type: Entity IDs, then Verse Keys."""
    by_type = {}
    for n in e["neighbours"]:
        by_type.setdefault(n["type"], []).append(n["id"])
    return {i for ids in by_type.values() for i in ids[:6]} | {v["key"] for v in e["verses"][:6]}


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
            ranked = (
                files[node]["neighbours"] if node in files else verses[node]["cross_references"]
            )
            assert top == [{"id": n["id"], "weight": n["weight"]} for n in ranked[:10]]
    abraham = entity(export, "person:abraham_58")
    assert abraham["ring2"]["person:isaac_616"][0] == {
        "id": "person:rebekah_2401",
        "weight": 0.4167,
    }
