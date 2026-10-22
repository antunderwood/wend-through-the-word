from conftest import VERSION, entity, neighbour, read_json, read_tsv

THEOGRAPHIC = {"source": "Theographic", "licence": "CC BY-SA 4.0"}


def test_parent_and_child_each_read_the_link_from_their_own_end(export):
    father = {"edge": "PARENT_OF", "role": "father", **THEOGRAPHIC}
    isaac = neighbour(export, "person:abraham_58", "person:isaac_616")
    assert (isaac["id"], isaac["type"]) == ("person:isaac_616", "person")
    assert {**father, "direction": "out"} in isaac["edges"]
    abraham = neighbour(export, "person:isaac_616", "person:abraham_58")
    assert {**father, "direction": "in"} in abraham["edges"]
    sarah = neighbour(export, "person:isaac_616", "person:sarah_2473")
    assert [e.get("role") for e in sarah["edges"] if e["edge"] == "PARENT_OF"] == ["mother"]


def edge_types(export, entity_id, other_id):
    """The explicit edges of a Neighbour, without the CO_MENTION (#8) that most pairs also have."""
    edges = neighbour(export, entity_id, other_id)["edges"]
    return [(e["edge"], e["direction"]) for e in edges if e["edge"] != "CO_MENTION"]


def test_half_siblings_come_only_from_theographic_half_sibling_fields(export):
    assert edge_types(export, "person:isaac_616", "person:ishmael_630") == [
        ("HALF_SIBLING_OF", "both")
    ]
    # Sarah shares Abraham's father and brothers in Theographic, but no field names her his
    # half sister, so the build derives nothing (decision 36).
    assert ("HALF_SIBLING_OF", "both") not in edge_types(
        export, "person:abraham_58", "person:sarah_2473"
    )
    assert edge_types(export, "person:abraham_58", "person:nahor_2143") == [("SIBLING_OF", "both")]


def test_place_event_and_group_edges_keep_their_direction(export):
    assert edge_types(export, "event:65", "person:abraham_58") == [("PARTICIPATED_IN", "in")]
    assert edge_types(export, "person:abraham_58", "event:65") == [("PARTICIPATED_IN", "out")]
    assert edge_types(export, "event:65", "place:ur_1189") == [("OCCURRED_AT", "out")]
    assert edge_types(export, "place:ur_1189", "event:65") == [("OCCURRED_AT", "in")]
    assert edge_types(export, "person:jesus_905", "group:tribe_of_judah") == [("MEMBER_OF", "out")]
    assert edge_types(export, "group:tribe_of_judah", "person:jesus_905") == [("MEMBER_OF", "in")]


def test_several_edges_between_one_pair_form_one_neighbour(export):
    # Haran was born and died in Ur (Gen 11:28).
    assert edge_types(export, "person:haran_1407", "place:ur_1189") == [
        ("BORN_AT", "out"),
        ("DIED_AT", "out"),
    ]
    assert edge_types(export, "place:ur_1189", "person:haran_1407") == [
        ("BORN_AT", "in"),
        ("DIED_AT", "in"),
    ]
    ur = [n["id"] for n in entity(export, "place:ur_1189")["neighbours"]]
    assert len(ur) == len(set(ur))


def test_entity_outside_the_book_range_ships_as_a_stub_with_its_neighbours_in_range(export):
    # No group but the Tribe of Judah has a verse in the fixture (decision 51).
    assert edge_types(export, "person:abraham_58", "group:genealogy_of_jesus") == [
        ("MEMBER_OF", "out")
    ]
    stub = entity(export, "group:genealogy_of_jesus")
    assert (stub["name"], stub["verses"], stub["source"]) == (
        "Genealogy of Jesus",
        [],
        "Theographic",
    )
    members = [n["id"] for n in stub["neighbours"]]
    assert "person:abraham_58" in members
    assert "person:adam_78" not in members  # Adam has no verse in the fixture either
    for path in (export / "data" / VERSION / "entity").rglob("*.json"):
        e = read_json(path)
        assert e["verses"] or e["neighbours"], e["id"]  # a stub has an edge into the range
        if not e["verses"]:
            assert all(entity(export, n["id"])["verses"] for n in e["neighbours"]), e["id"]


def test_only_people_and_people_groups_ship_as_stubs(export):
    stubs = [
        read_json(p)["type"]
        for p in (export / "data" / VERSION / "entity").rglob("*.json")
        if not read_json(p)["verses"]
    ]
    assert set(stubs) == {"person", "group"}


def test_place_or_event_edge_to_an_end_outside_the_range_is_dropped_and_reported(export):
    # Rachel is in range (Matt 2:18); Ephrath, where she died, has no verse in the fixture.
    rachel = [n["id"] for n in entity(export, "person:rachel_2386")["neighbours"]]
    assert "place:ephrath_403" not in rachel
    assert not (export / "data" / VERSION / "entity" / "place" / "ephrath_403.json").exists()
    rows = read_tsv(export / "reports" / "dropped_edges.tsv")
    assert {
        "record": "person:rachel_2386",
        "field": "deathPlace",
        "link": "place:ephrath_403",
        "cause": "other end is outside the book range, and only People and People Groups "
        "ship as stubs (decision 51, until M6)",
    } in rows


def test_every_edge_reads_the_same_from_both_ends(export):
    flip = {"out": "in", "in": "out", "both": "both"}
    seen = 0
    for path in (export / "data" / VERSION / "entity").rglob("*.json"):
        e = read_json(path)
        for n in e["neighbours"]:
            back = neighbour(export, n["id"], e["id"])
            assert n["type"] == n["id"].split(":")[0]
            assert [(x["edge"], flip[x["direction"]], x.get("role")) for x in n["edges"]] == [
                (x["edge"], x["direction"], x.get("role")) for x in back["edges"]
            ]
            seen += len(n["edges"])
    assert seen > 100


def test_a_theographic_partner_pair_with_no_curated_row_ships_as_partner_of(export):
    # Pairs with a curated row: tests/test_curated.py (#7).
    assert edge_types(export, "person:isaac_616", "person:rebekah_2401") == [("PARTNER_OF", "both")]
    assert edge_types(export, "person:rebekah_2401", "person:isaac_616") == [("PARTNER_OF", "both")]
    rows = read_tsv(export / "reports" / "uncurated_partners.tsv")
    assert {"man_id": "person:isaac_616", "woman_id": "person:rebekah_2401"} in rows
    assert len(rows) == len({(r["man_id"], r["woman_id"]) for r in rows})


def test_edge_to_a_record_that_does_not_exist_is_dropped_and_reported(export):
    # The fixture adds a sibling link to a record ID that is not in Theographic to Abraham.
    rows = read_tsv(export / "reports" / "dropped_edges.tsv")
    assert {
        "record": "person:abraham_58",
        "field": "siblings",
        "link": "recFixtureNoRecord",
        "cause": "links to a record that is not in Theographic, so the edge has no clear end",
    } in rows
