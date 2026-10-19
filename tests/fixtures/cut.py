"""Cut the fixture sources from a full download. Run from the repo root:

    python -I tests/fixtures/cut.py SOURCES_DIR

Keeps only the chapters below. Strips KJV text from Theographic verses (decision 42).
Adds one synthetic BSB line, 3 John 1:15, to test a BSB verse with no Theographic key.
"""

import json
import re
import sys
from pathlib import Path

CHAPTERS = {"Gen": {11, 16, 25, 26, 36}, "Matt": {17}, "3John": {1}}
MATT_VERSES = {20, 21, 22}  # Matt 17:21 has no BSB text
BSB_NAMES = {"Genesis": "Gen", "Matthew": "Matt", "3 John": "3John"}
KJV_FIELDS = {"verseText", "mdText", "richText"}

src, dest = Path(sys.argv[1]), Path(__file__).parent / "sources"


def keep(book, ch, vs):
    return ch in CHAPTERS.get(book, ()) and (book != "Matt" or vs in MATT_VERSES)


def dump(name, rows):
    (dest / name).write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")


books = [
    r for r in json.loads((src / "books.json").read_text()) if r["fields"]["osisName"] in CHAPTERS
]
for r in books:
    r["fields"] = {k: v for k, v in r["fields"].items() if not isinstance(v, list)}
dump("books.json", books)

verses = []
for r in json.loads((src / "verses.json").read_text()):
    book, ch, vs = r["fields"]["osisRef"].split(".")
    if keep(book, int(ch), int(vs)):
        r["fields"] = {k: v for k, v in r["fields"].items() if k not in KJV_FIELDS}
        verses.append(r)
dump("verses.json", verses)

lines = []
for line in (src / "bsb.txt").read_text(encoding="utf-8-sig").splitlines():
    m = re.match(r"(.+) (\d+):(\d+)\t", line)
    if not m:
        lines.append(line)  # header
    elif m[1] in BSB_NAMES and keep(BSB_NAMES[m[1]], int(m[2]), int(m[3])):
        lines.append(line)
lines.append("3 John 1:15\tSynthetic test line: a BSB verse with no Theographic key.")
(dest / "bsb.txt").write_text("\n".join(lines) + "\n")

# Entities that a kept verse mentions, with their `verses` cut to the kept verses.
kept = {r["fields"]["osisRef"]: r["id"] for r in verses}
SYNTHETIC = {  # (file, ID field, ID) -> change, each one listed in README.md
    ("people.json", "personLookup", "abraham_58"): lambda f: f["verses"].append(
        "recFixtureNoVerse"  # a mention whose verse record does not exist
    ),
    ("people.json", "personLookup", "demetrius_1007"): lambda f: f.pop("dictText"),
    ("peopleGroups.json", "groupName", "Tribe of Judah"): lambda f: f.update(
        verses=[kept["Gen.36.1"]]  # no group has a real verse in the kept chapters
    ),
}
# Decision 41: Theographic coordinates are made up, so a test can spot them in the export.
LAT, LON = "-11.111111", "-22.222222"
THEO_COORDS = dict.fromkeys(("latitude", "openBibleLat", "recogitoLat"), LAT)
THEO_COORDS |= dict.fromkeys(("longitude", "openBibleLong", "recogitoLon"), LON)
for name in ("people.json", "places.json", "events.json", "peopleGroups.json"):
    rows = []
    for r in json.loads((src / name).read_text()):
        f = r["fields"]
        f["verses"] = [v for v in f.get("verses") or [] if v in kept.values()]
        for (file, field, value), change in SYNTHETIC.items():
            if file == name and f.get(field) == value:
                change(f)
        if name == "places.json":
            f.update({k: v for k, v in THEO_COORDS.items() if k in f})
        if f["verses"]:
            rows.append(r)
    dump(name, rows)

# OpenBible geocoding, joined through Theographic's links (decision 56).
places = {r["fields"]["placeLookup"] for r in json.loads((dest / "places.json").read_text())}
THEO_PLACE, OB_ANCIENT = "theographic.netlify.app/place/", "openbible.info/geo/ancient/"


def link_id(url):
    return url.rstrip("/").rsplit("/", 1)[1]


features = []
for f in json.loads((src / "bible-places.geojson").read_text())["features"]:
    links = [x["identifier"] for x in f.get("links") or []]
    if any(THEO_PLACE in x and link_id(x) in places for x in links):
        features.append({"type": "Feature", "geometry": None, "links": f["links"]})  # dec. 41
seir = next(f for f in features if any(x["identifier"].endswith("/seir_1042/") for x in f["links"]))
seir["links"].append({"type": "seeAlso", "identifier": f"https://www.{OB_ANCIENT}a2735ff"})
(dest / "bible-places.geojson").write_text(
    json.dumps({"type": "FeatureCollection", "features": features}, indent=1) + "\n"
)

ob_ids = {
    link_id(x["identifier"]) for f in features for x in f["links"] if OB_ANCIENT in x["identifier"]
}
ancient = [
    r
    for r in map(json.loads, (src / "ancient.jsonl").read_text().splitlines())
    if r["id"] in ob_ids
]
for r in ancient:  # size: drop fields the build does not read
    for k in ("verses", "extra", "media", "identification_sources"):
        r.pop(k, None)
    for i in r["identifications"]:
        i.pop("media", None)
modern = {r["id"]: r for r in map(json.loads, (src / "modern.jsonl").read_text().splitlines())}
want = {
    res["modern_basis_id"]
    for r in ancient
    for i in r["identifications"]
    for res in i.get("resolutions", [])
    if "modern_basis_id" in res
}
while roots := {modern[m]["root"]["id"] for m in want if "root" in modern[m]} - want:
    want |= roots
modern = {m: modern[m] for m in sorted(want)}


def first_point(ancient_id):  # the modern record that gives the point of an ancient record
    first = next(r for r in ancient if r["id"] == ancient_id)["identifications"][0]
    return modern[next(x for x in first["resolutions"] if "lonlat" in x)["modern_basis_id"]]


kadesh = first_point("ac2cef0")  # kadesh_661
kadesh["coordinates_source"]["type"] = "osm"
first_point("a43608b")["custom_lonlat"] = "5.555555,6.666666"  # esek_409
first_point("aeb9e97")["coordinates_source"]["type"] = "google_maps"  # mamre_762
shur = first_point("acdbce0")  # shur_1090
del shur["coordinates_source"]
shur["root"] = {"id": kadesh["id"], "source": "modern"}
# Decision 44: made-up coordinates for every record whose point is OpenStreetMap derived,
# commercial, from Google, or inherited from a root record.
made_up = set()
for m in modern.values():
    src_type = m.get("coordinates_source", {}).get("type")
    if src_type in (None, "osm", "google_maps", "google_earth_community") or (
        "custom_lonlat" in m or m.get("geometry_credit") == "osm"
    ):
        m["lonlat"] = "1.111111,2.222222"
        if "custom_lonlat" in m:
            m["custom_lonlat"] = "5.555555,6.666666"
        made_up.add(m["id"])
for r in ancient:
    for i in r["identifications"]:
        for res in i.get("resolutions", []):
            if "lonlat" in res and res.get("modern_basis_id") in made_up:
                res["lonlat"] = modern[res["modern_basis_id"]]["lonlat"]
for name, rows in (("ancient.jsonl", ancient), ("modern.jsonl", modern.values())):
    (dest / name).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
