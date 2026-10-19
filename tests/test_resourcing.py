"""Places whose OpenBible point is dropped are looked up again in Pleiades, then Wikidata, then
GeoNames (ticket #11). The fixture lookups are slices of the real files; OpenStreetMap records
in them have made-up coordinates (decision 44)."""

from conftest import VERSION, read_json, run_build
from test_coordinates import no_coordinate, place


def point(export, name):
    p = place(export, name)
    return p.get("lat"), p.get("lon"), p.get("coord_source")


def test_dropped_place_that_pleiades_knows_gets_the_pleiades_point_without_its_osm_location(
    export,
):
    # Harran's point is on OpenStreetMap geometry. Its Wikidata item gives Pleiades 658427, which
    # has a DARE, a CIGS, and an OpenStreetMap location; the point is the mean of the first two.
    haran = place(export, "haran_527")
    assert (haran["lat"], haran["lon"], haran["coord_source"]) == (36.864046, 39.031246, "Pleiades")
    assert haran["confidence"] == 922  # OpenBible's identification is kept
    assert "place:haran_527" not in no_coordinate(export)


def test_wikidata_comes_before_geonames(export):
    # Ruheibeh (Rehoboth) cites Wikidata Q26768940 and GeoNames 8367629; Pleiades has no entry.
    assert point(export, "rehoboth_990") == (31.031111111111, 34.565833333333, "Wikidata")


def test_wikidata_coordinate_that_cites_openstreetmap_is_not_used(export):
    # The Cave of the Patriarchs (Machpelah), Q204200, has one coordinate, "stated in"
    # OpenStreetMap (made up in the fixture: 3.333333, 4.444444). GeoNames 8073316 is next.
    assert point(export, "machpelah_748") == (31.52492, 35.1109, "GeoNames")


def test_openstreetmap_place_that_no_source_knows_has_no_point_and_is_reported(export):
    # Kadesh's record is set to source "osm" in the fixture and cites no other source.
    assert "lat" not in place(export, "kadesh_661")
    assert "confidence" not in place(export, "kadesh_661")
    assert no_coordinate(export)["place:kadesh_661"] == "OpenBible point dropped: OpenStreetMap"


def test_pleiades_place_with_only_openstreetmap_locations_gives_no_point(export):
    # Ain Shams (Egypt) cites Q191687, whose Pleiades place 727117 has only an OpenStreetMap
    # location, and Q23973758, which has a coordinate.
    assert point(export, "egypt_362") == (30.129444444444, 31.3075, "Wikidata")


def test_openbible_point_from_wikidata_that_cites_openstreetmap_is_dropped(export):
    # Decision 58. The fixture makes Canaan's Wikidata coordinate (Q163329) cite OpenStreetMap.
    assert "lat" not in place(export, "canaan_272")
    cause = "OpenBible point dropped: Wikidata cites OpenStreetMap"
    assert no_coordinate(export)["place:canaan_272"] == cause


def test_curated_correction_sets_a_point_with_its_evidence(export):
    # Synthetic row in the fixture corrections.csv: Babel set to 32.5,44.4 (owner decision).
    babel = place(export, "babel_150")
    assert point(export, "babel_150") == (32.5, 44.4, "Curated")
    assert "confidence" not in babel
    fix = babel["corrections"][0]
    assert (fix["field"], fix["source"], fix["evidence"][0]["label"]) == (
        "coordinates",
        "Curated",
        "Gen.11.9",
    )
    assert "place:babel_150" not in no_coordinate(export)


def test_curated_correction_removes_a_point_and_reports_the_place(export):
    # Synthetic row: Pau's re-sourced Wikidata point is removed.
    assert point(export, "pau_927") == (None, None, None)
    assert "confidence" not in place(export, "pau_927")
    assert no_coordinate(export)["place:pau_927"] == "point removed by a curated correction"


def test_credits_list_each_lookup_source_with_its_licence(export):
    entries = read_json(export / "data" / VERSION / "credits.json")["sources"]
    licences = {e["name"]: (e["licence"], e["link"]) for e in entries}
    assert licences["Pleiades"] == ("CC BY 3.0", "https://pleiades.stoa.org/")
    assert licences["Wikidata"] == ("CC0 1.0", "https://www.wikidata.org/")
    assert licences["GeoNames"] == ("CC BY 4.0", "https://www.geonames.org/")


def test_build_never_touches_the_network(tmp_path, monkeypatch):
    # Python imports sitecustomize at start up; this one makes every connection fail.
    (tmp_path / "sitecustomize.py").write_text(
        "import socket\n"
        "def refuse(*args, **kwargs):\n"
        "    raise OSError('the build must not use the network')\n"
        "socket.socket.connect = socket.create_connection = socket.getaddrinfo = refuse\n"
    )
    monkeypatch.setenv("PYTHONPATH", str(tmp_path))
    out = run_build(tmp_path / "out")
    assert (out / "reports" / "no_coordinate.tsv").exists()
