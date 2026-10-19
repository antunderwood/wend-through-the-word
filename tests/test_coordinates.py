from conftest import FIXTURES, no_coordinate, openstreetmap_shipped, place, shipped_points


def test_place_with_a_cc_by_openbible_point_has_coordinate_confidence_and_source(export):
    gerar = place(export, "gerar_459")  # Tel Haror, sourced from Wikidata
    assert (gerar["lat"], gerar["lon"]) == (31.3821, 34.6065)
    assert gerar["confidence"] == 694
    assert gerar["coord_source"] == "OpenBible"


def test_openstreetmap_point_is_dropped_and_reported(export):
    # The fixture sets Kadesh's modern record to source "osm", with made-up coordinates.
    assert "lat" not in place(export, "kadesh_661")
    assert no_coordinate(export)["place:kadesh_661"] == "OpenBible point dropped: OpenStreetMap"


def export_text(export):
    return "\n".join(p.read_text() for p in sorted((export / "data").rglob("*.json")))


def test_commercial_point_and_its_custom_lonlat_are_not_shipped(export):
    # The fixture gives Esek's modern record a made-up custom_lonlat "5.555555,6.666666".
    # Esek is then re-sourced from the Wikidata item its record cites (test_resourcing.py).
    assert place(export, "esek_409")["coord_source"] != "OpenBible"
    assert "5.555555" not in export_text(export)
    assert "6.666666" not in export_text(export)


def test_google_sourced_point_is_dropped(export):
    # The fixture sets Mamre's modern record to source "google_maps".
    assert "lat" not in place(export, "mamre_762")
    assert no_coordinate(export)["place:mamre_762"] == "OpenBible point dropped: Google"


def test_point_on_openstreetmap_geometry_is_dropped_whatever_its_source(export):
    # Ur's modern record, Tell el Muqayyar, is sourced from Wikidata but has OSM geometry.
    # Ur is then re-sourced (test_resourcing.py), so its point is not OpenBible's.
    assert place(export, "ur_1189")["coord_source"] != "OpenBible"


def test_point_with_no_source_of_its_own_is_checked_through_its_root(export):
    # The fixture removes coordinates_source from Shur's record and roots it on Kadesh's OSM record.
    # Shur is then re-sourced from the GeoNames ID its own record cites (test_resourcing.py).
    assert place(export, "shur_1090")["coord_source"] != "OpenBible"


def test_place_linked_to_two_openbible_records_gets_no_point_and_is_reported(export):
    # The fixture adds a second OpenBible link (Edom's record) to Seir's feature.
    assert "lat" not in place(export, "seir_1042")
    assert no_coordinate(export)["place:seir_1042"] == "more than one OpenBible record"


def test_no_theographic_coordinate_ships(export):
    # The fixture sets every Theographic coordinate field to -11.111111 or -22.222222.
    text = export_text(export)
    assert "11.111111" not in text and "22.222222" not in text
    for field in ("latitude", "longitude", "openBibleLat", "recogitoLat", "recogitoLon"):
        assert f'"{field}"' not in text


def test_no_shipped_coordinate_has_an_openstreetmap_source(export):
    shipped = shipped_points(export)
    assert {p["coord_source"] for p in shipped} <= {
        "OpenBible",
        "Pleiades",
        "Wikidata",
        "GeoNames",
        "Curated",
    }
    assert not openstreetmap_shipped(export, FIXTURES)
    openbible = [p for p in shipped if p["coord_source"] == "OpenBible"]
    assert sorted(p["id"].split(":")[1] for p in openbible) == [
        "avith_122",
        "beer-lahai-roi_167",
        "dinhabah_337",
        "galilee_433",
        "gerar_459",
        "masrekah_770",
        "midian_796",
        "moab_815",
        "rehoboth_991",
        "valley_of_gerar_1203",
    ]
