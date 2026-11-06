"""UBS Bible Routes on the map (decision 220). The fixture zip holds five real route files; the
fixture routes.csv joins them to passages, with one unreviewed row and one outside the books."""

import shutil
import subprocess

import pytest
from conftest import CURATED, read_json, read_tsv, run_build


def routes(export):
    return {r["id"]: r for r in read_json(export / "data" / "test1" / "routes.json")["routes"]}


def entity(export, kind, name):
    return read_json(export / "data" / "test1" / "entity" / kind / f"{name}.json")


def test_a_reviewed_route_in_the_book_range_ships_with_its_passage_and_lines(export):
    hagar = routes(export)["route:015_hagar_flees_towards_shur"]
    assert hagar["title"] == "Hagar flees towards Shur"
    assert hagar["verses"][0] == "Gen.16.6" and hagar["verses"][-1] == "Gen.16.14"
    assert len(hagar["lines"]) == 3  # the file's three lines
    lon, lat = hagar["lines"][0][0]
    assert 29 < lon < 36 and 29 < lat < 33  # Sinai and the Negev, as longitude then latitude
    assert lon == round(lon, 4)


def test_an_unreviewed_row_or_one_outside_the_books_does_not_ship(export):
    shipped = routes(export)
    assert "route:026_isaac_goes_up_to_beersheba" not in shipped  # not reviewed
    assert "route:205_pauls_voyage_to_rome" not in shipped  # its passage is outside the books
    report = {r["id"]: r for r in read_tsv(export / "reports" / "routes.tsv")}
    assert report["route:026_isaac_goes_up_to_beersheba"]["shipped"] == ""


def test_an_unsure_row_ships_flagged_unreviewed_and_a_reviewed_one_is_not(export):
    shipped = routes(export)
    assert shipped["route:027_isaac_beersheba_unsure"]["unreviewed"] is True
    assert "unreviewed" not in shipped["route:015_hagar_flees_towards_shur"]


def test_people_places_and_events_of_the_passage_list_the_route_most_shared_first(export):
    assert entity(export, "person", "hagar_1348")["routes"] == [
        "route:015_hagar_flees_towards_shur"
    ]
    assert entity(export, "place", "gerar_459")["routes"] == ["route:025_isaac_goes_to_gerar"]
    assert "route:155a_the_flight_to_egypt" in entity(export, "person", "jesus_905")["routes"]
    assert "routes" not in entity(export, "theme", "famine")  # Themes are never listed


def test_the_routes_file_and_credit_name_ubs(export):
    data = read_json(export / "data" / "test1" / "routes.json")
    assert data["licence"] == "CC BY-SA 4.0"
    credits = read_json(export / "data" / "test1" / "credits.json")["sources"]
    ubs = next(e for e in credits if e["files"] == ["ubs-routes"])
    assert "Leen Ritmeyer" in ubs["credit"]


def test_a_passage_that_is_not_verses_fails_the_build(tmp_path):
    curated = shutil.copytree(CURATED, tmp_path / "curated")
    table = curated / "routes.csv"
    table.write_text(table.read_text().replace("Gen.26.23", "Gen.26.99"))
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=curated)
