import csv
import gzip
import json
import subprocess
import sys
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "sources"
CURATED = FIXTURES.parent / "curated"  # fixture copies of the curated tables, with test rows
REAL_CURATED = Path(__file__).parent.parent / "pipeline" / "curated"
VERSION = "test1"
TIPNR = (  # the TIPNR file name, in the fixture and in a download
    "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt"
)
# A size limit that makes the build trim cross-references in some chapter files and Ring 2
# sidecars, but stays above every file that cannot be trimmed (Abraham's entity file is about
# 51 KB), so the build still succeeds (story 74).
TRIM_LIMIT = 62000


def run_build(out, sources=FIXTURES, books=("Gen", "Matt", "3John"), curated=CURATED, **extra):
    """Run the build command, the one test seam. Returns the output folder. `extra` holds more
    config keys with integer values, such as `size_limit`."""
    config = out.parent / f"{out.name}.toml"
    config.write_text(
        f"books = {json.dumps(list(books))}\n"
        f'sources = "{sources}"\n'
        f'curated = "{curated}"\n'
        f'out = "{out}"\n'
        'build_date = "2026-10-19"\n'
        f'data_version = "{VERSION}"\n' + "".join(f"{k} = {v}\n" for k, v in extra.items())
    )
    subprocess.run([sys.executable, "-m", "pipeline.build", config], check=True)
    return out


@pytest.fixture(scope="session")
def export(tmp_path_factory):
    return run_build(tmp_path_factory.mktemp("build") / "out")


def read_json(path):
    return json.loads(path.read_text())


def read_tsv(path):
    header, *rows = path.read_text().splitlines()
    return [dict(zip(header.split("\t"), r.split("\t"))) for r in rows]


def nodes_and_edges(obj):
    """Every dict in the export that is a node (has a `key` or `id`) or an edge (has `edge`).
    A Neighbour is not one: it points at a node, and each of its `edges` is checked. Ring 2
    entries are left out too: the spec keeps them to an ID and a weight only. The chapter Ring 2
    file names their source and licence once at the top; in an entity file, each entry repeats a
    Neighbour whose edges, with source and licence, are in its Ring 1 node's own file."""
    if isinstance(obj, dict):
        neighbour = "edges" in obj or obj.keys() == {"id", "weight"}
        if {"key", "id", "edge"} & obj.keys() and not neighbour:
            yield obj
        for v in obj.values():
            yield from nodes_and_edges(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from nodes_and_edges(v)


# Helpers shared by the test modules.


def entity(export, entity_id):
    kind, name = entity_id.split(":")
    return read_json(export / "data" / VERSION / "entity" / kind / f"{name}.json")


def neighbour(export, entity_id, other_id):
    return next(n for n in entity(export, entity_id)["neighbours"] if n["id"] == other_id)


def chapter_verse(export, label):
    book, ch, _ = label.split(".")
    path = export / "data" / VERSION / "chapter" / book / f"{ch}.json"
    return next(v for v in read_json(path)["verses"] if v["label"] == label)


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


def place(export, name):
    return read_json(export / "data" / VERSION / "entity" / "place" / f"{name}.json")


def no_coordinate(export):
    rows = read_tsv(export / "reports" / "no_coordinate.tsv")
    return {r["place"]: r["cause"] for r in rows}


def shipped_points(export):
    places = (export / "data" / VERSION / "entity" / "place").glob("*.json")
    return [p for p in map(read_json, places) if "lat" in p]


def openstreetmap_points(sources):
    """Coordinate source -> its points that come from OpenStreetMap: OpenBible modern records
    whose source or geometry is OpenStreetMap, Pleiades OpenStreetMap locations, and Wikidata
    coordinates whose reference cites OpenStreetMap. GeoNames and Curated have none."""
    points = {
        "OpenBible": set(),
        "Pleiades": set(),
        "Wikidata": set(),
        "GeoNames": set(),
        "Curated": set(),
    }
    for line in (sources / "modern.jsonl").read_text().splitlines():
        rec = json.loads(line)
        if rec.get("coordinates_source", {}).get("type") == "osm" or "geometry_credit" in rec:
            lon, lat = map(float, rec["lonlat"].split(","))
            points["OpenBible"].add((lat, lon))
    csv.field_size_limit(10**9)
    with gzip.open(sources / "pleiades-locations-latest.csv.gz", "rt", encoding="utf-8") as f:
        for loc in csv.DictReader(f):
            text = f"{loc['id']} {loc['title']} {loc['description']}".lower()
            if loc["reprLat"] and ("osm" in text or "openstreetmap" in text):
                points["Pleiades"].add((float(loc["reprLat"]), float(loc["reprLong"])))
    for row in read_json(sources / "wikidata-coords.json")["results"]["bindings"]:
        ref = row.get("refVal", {}).get("value", "")
        if ref.endswith("/entity/Q936") or "openstreetmap" in ref.lower():
            points["Wikidata"].add((float(row["lat"]["value"]), float(row["lon"]["value"])))
    return points


def openstreetmap_shipped(export, sources):
    """Shipped points that equal an OpenStreetMap point of the source they claim. (OpenBible
    copies some Wikidata and Pleiades points, so the same value can be in two sources.)"""
    osm = openstreetmap_points(sources)
    return [p for p in shipped_points(export) if (p["lat"], p["lon"]) in osm[p["coord_source"]]]


def top_people(e):
    return [n["id"] for n in e["neighbours"] if n["type"] == "person"][:6]
