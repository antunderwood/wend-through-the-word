"""Cut the fixture sources from a full download. Run from the repo root:

    python -I tests/fixtures/cut.py SOURCES_DIR

Keeps only the chapters below. Strips KJV text from Theographic verses (decision 42).
Adds one synthetic BSB line, 3 John 1:15, to test a BSB verse with no Theographic key.
Keeps the OpenBible cross-references that touch a kept verse, with two synthetic rows.
"""

import csv
import gzip
import io
import json
import re
import sys
import zipfile
from pathlib import Path

CHAPTERS = {"Gen": {11, 16, 25, 26, 36}, "Matt": {1, 2, 16, 17}, "John": {1}, "3John": {1}}
# Chapters cut to some verses. Matt 17:21 has no BSB text. Matt 16:13 to 20 (Peter's
# confession) and John 1:1 are for the tour (decision 174).
PART = {("Matt", 16): set(range(13, 21)), ("Matt", 17): {20, 21, 22}, ("John", 1): {1}}
BSB_NAMES = {"Genesis": "Gen", "Matthew": "Matt", "John": "John", "3 John": "3John"}
KJV_FIELDS = {"verseText", "mdText", "richText"}

src, dest = Path(sys.argv[1]), Path(__file__).parent / "sources"


def keep(book, ch, vs):
    return ch in CHAPTERS.get(book, ()) and vs in PART.get((book, ch), {vs})


def dump(name, rows):
    (dest / name).write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")


books = json.loads((src / "books.json").read_text())  # all 66: the search index names them all
for r in books:
    r["fields"] = {k: v for k, v in r["fields"].items() if not isinstance(v, list)}
dump("books.json", books)

verses = []
for r in json.loads((src / "verses.json").read_text()):
    book, ch, vs = r["fields"]["osisRef"].split(".")
    if keep(book, int(ch), int(vs)):
        r["fields"] = {k: v for k, v in r["fields"].items() if k not in KJV_FIELDS}
        verses.append(r)

# Cross-references with an end in a kept verse. Every other end must be outside the fixture
# books, so it adds no Verse to the build; the Theographic records of those ends are kept with
# only their osisRef and verseID.
zipped = zipfile.ZipFile(src / "cross-references.zip")
header, *rows = zipped.read("cross_references.txt").decode().splitlines()
kept_refs = {r["fields"]["osisRef"] for r in verses} | {"3John.1.15"}
crossrefs, outside = [header], set()
for row in rows:
    a, b, _ = row.split("\t")
    refs = {a, *b.split("-")}
    if refs & kept_refs and all(r in kept_refs or r.split(".")[0] not in CHAPTERS for r in refs):
        crossrefs.append(row)
        outside |= refs - kept_refs
crossrefs += [
    "Matt.17.20\t3John.1.15\t3",  # synthetic: a cross-reference to 3John.1.15
    "Gen.11.1\tGen.11.33\t1",  # synthetic: Genesis 11 has 32 verses, so no Verse Key
]
info = zipfile.ZipInfo("cross_references.txt", date_time=(1980, 1, 1, 0, 0, 0))
with zipfile.ZipFile(dest / "cross-references.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr(info, "\n".join(crossrefs) + "\n", zipfile.ZIP_DEFLATED)
ends = [
    {"id": r["id"], "fields": {k: r["fields"][k] for k in ("osisRef", "verseID")}}
    for r in json.loads((src / "verses.json").read_text())
    if r["fields"]["osisRef"] in outside
]
dump("verses.json", verses + ends)

lines = []
for line in (src / "bsb.txt").read_text(encoding="utf-8-sig").splitlines():
    m = re.match(r"(.+) (\d+):(\d+)\t", line)
    if not m:
        lines.append(line)  # header
    elif m[1] in BSB_NAMES and keep(BSB_NAMES[m[1]], int(m[2]), int(m[3])):
        lines.append(line)
lines.append("3 John 1:15\tSynthetic test line: a BSB verse with no Theographic key.")
(dest / "bsb.txt").write_text("\n".join(lines) + "\n")

# Entities that a kept verse mentions, with their `verses` cut to the kept verses, and the
# records their edge fields link to, with no verses (stubs outside the book range).
kept = {r["fields"]["osisRef"]: r["id"] for r in verses}
EDGE_FIELDS = [
    *("father", "mother", "children", "siblings", "partners", "memberOf"),
    *("halfSiblingsSameFather", "halfSiblingsSameMother", "birthPlace", "deathPlace"),
    *("participants", "locations"),
]
SYNTHETIC = {  # (file, ID field, ID) -> change, each one listed in README.md
    ("people.json", "personLookup", "abraham_58"): lambda f: (
        f["verses"].append("recFixtureNoVerse"),  # a mention whose verse record does not exist
        f["siblings"].append("recFixtureNoRecord"),  # an edge to a record that does not exist
    ),
    ("people.json", "personLookup", "demetrius_1007"): lambda f: f.pop("dictText"),
    # A letter greeting that names Jesus Christ beside Gaius (decision 176)
    ("people.json", "personLookup", "jesus_905"): lambda f: f["verses"].append(kept["3John.1.1"]),
    ("peopleGroups.json", "groupName", "Tribe of Judah"): lambda f: f.update(
        verses=[kept["Gen.36.1"]]  # no group has a real verse in the kept chapters
    ),
}
# Synthetic: a second Sitnah that shares Sitnah's only Verse, as the two Valleys of Shaveh share
# Gen 14:17, and also names Gen 26:22, to test the same-name hint (decision 122).
SITNAH_TWIN = {
    "id": "recFixtureSitnah",
    "fields": {
        "placeLookup": "sitnah_9102",
        "displayTitle": "Sitnah",
        "placeID": 9102,
        "verses": [kept["Gen.26.21"], kept["Gen.26.22"]],
    },
}
# Synthetic: a fourth Anah, a stub (Zibeon's daughter) with Verses only outside the fixture books,
# one of them shared with anah_249, to test the same-name hint of a stub (decision 122).
ENDS = {r["fields"]["osisRef"]: r["id"] for r in ends}
ANAH_STUB = {
    "id": "recFixtureAnah",
    "fields": {
        "personLookup": "anah_9250",
        "displayTitle": "Anah",
        "name": "Anah",
        "personID": 9250,
        "gender": "Female",
        "verses": [ENDS["1Chr.1.39"], ENDS["1Chr.1.40"]],
        "father": ["recsCvIS5fxl25zU6"],  # zibeon_3061
    },
}
# Decision 41: Theographic coordinates are made up, so a test can spot them in the export.
LAT, LON = "-11.111111", "-22.222222"
THEO_COORDS = dict.fromkeys(("latitude", "openBibleLat", "recogitoLat"), LAT)
THEO_COORDS |= dict.fromkeys(("longitude", "openBibleLong", "recogitoLon"), LON)
NAMES = ("people.json", "places.json", "events.json", "peopleGroups.json")
records = {name: json.loads((src / name).read_text()) for name in NAMES}
in_range, outside_ids = set(kept.values()), {r["id"] for r in ends}
mentioned = {
    r["id"]
    for rows in records.values()
    for r in rows
    if in_range & set(r["fields"].get("verses") or [])
}
# A mentioned record also keeps its links to the kept verses outside the fixture books, so its
# whole-Bible Verse set (decision 95) holds more than its Verses in range.
for r in (r for rows in records.values() for r in rows):
    keep_ids = in_range | outside_ids if r["id"] in mentioned else in_range
    r["fields"]["verses"] = [v for v in r["fields"].get("verses") or [] if v in keep_ids]
linked = {
    rec
    for rows in records.values()
    for r in rows
    if r["id"] in mentioned
    for field in EDGE_FIELDS
    for rec in r["fields"].get(field) or []
}
for name, rows in records.items():
    rows = [r for r in rows if r["id"] in mentioned | linked]
    for r in rows:
        f = r["fields"]
        for field in EDGE_FIELDS:
            if field in f:
                f[field] = [rec for rec in f[field] if rec in mentioned | linked]
        for (file, field, value), change in SYNTHETIC.items():
            if file == name and f.get(field) == value:
                change(f)
        if name == "places.json":
            f.update({k: v for k, v in THEO_COORDS.items() if k in f})
    if name == "places.json":
        rows.append(SITNAH_TWIN)
    if name == "people.json":
        rows.append(ANAH_STUB)
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

# Lookups (#11): the Wikidata, Pleiades, and GeoNames records the kept modern records cite.
refs = [
    r
    for m in modern.values()
    for r in [m.get("coordinates_source", {})] + m.get("secondary_sources", [])
]
cited = {
    t: {r["id"] for r in refs if r.get("type") == t} for t in ("wikidata", "pleiades", "geonames")
}
wikidata = json.loads((src / "wikidata-coords.json").read_text())


def cites_osm(row):
    value = row.get("refVal", {}).get("value", "")
    return value.endswith("/entity/Q936") or "openstreetmap" in value.lower()


# Canaan's statement is made to cite OpenStreetMap, to test decision 58 on a kept point.
canaan = next(r for r in wikidata["results"]["bindings"] if r["item"]["value"].endswith("/Q163329"))
OSM_REF = {
    "refProp": "http://www.wikidata.org/prop/reference/P248",
    "refVal": "http://www.wikidata.org/entity/Q936",
}
wikidata["results"]["bindings"].append(
    canaan | {k: {"type": "uri", "value": v} for k, v in OSM_REF.items()}
)
rows = {}  # size: keep references only when they cite OpenStreetMap
for r in wikidata["results"]["bindings"]:
    if link_id(r["item"]["value"]) in cited["wikidata"]:
        if not cites_osm(r):
            r = {k: v for k, v in r.items() if k not in ("refProp", "refVal")}
        rows[json.dumps(r, sort_keys=True)] = r
osm_statements = {r["st"]["value"] for r in rows.values() if cites_osm(r)}
for r in rows.values():
    if r.get("st", {}).get("value") in osm_statements:  # decision 44
        r["lat"]["value"], r["lon"]["value"] = "3.333333", "4.444444"
    cited["pleiades"].add(r.get("pleiades", {}).get("value"))
    cited["geonames"].add(r.get("geonames", {}).get("value"))
wikidata["results"]["bindings"] = sorted(rows.values(), key=lambda r: json.dumps(r, sort_keys=True))
(dest / "wikidata-coords.json").write_text(json.dumps(wikidata, indent=1, sort_keys=True) + "\n")

PLEIADES = "pleiades-locations-latest.csv.gz"
csv.field_size_limit(10**9)
with gzip.open(src / PLEIADES, "rt", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)
    header = reader.fieldnames
    locations = [r for r in reader if r["pid"].rsplit("/", 1)[1] in cited["pleiades"]]
out = io.StringIO()
writer = csv.DictWriter(out, header, lineterminator="\n")
writer.writeheader()
for r in locations:
    r.update(geometry="", bbox="")  # coordinates the build does not read
    if (
        r["id"].startswith("osm")
        or re.search(r"\bOSM\b", r["title"], re.IGNORECASE)
        or ("openstreetmap" in r["description"].lower())
    ):  # decision 44
        r.update(reprLat="7.777777", reprLong="8.888888", reprLatLong="7.777777,8.888888")
    writer.writerow(r)
(dest / PLEIADES).write_bytes(gzip.compress(out.getvalue().encode(), mtime=0))

# Nave's (#12): the headings that file a kept verse, with only their references to verses in
# verses.json (cutting a range that leaves the fixture). Lines with no reference are kept as
# they are; a line whose references are all cut is dropped. A whole chapter stays when it is a
# kept chapter, so the build can skip and report it (decision 59).
NAVES = "NavesTopicalDictionary.csv"
CODES = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC So ISA "
    "JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO "
    "2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN Jude REV"
)
all_books = json.loads((src / "books.json").read_text())  # in Bible order
osis = dict(zip(CODES.split(), [r["fields"]["osisName"] for r in all_books]))
SEG = r"\d+(?::\d+(?:-\d+(?::\d+)?)?(?:,\d+(?:-\d+)?)*)?(?!\w)"  # not the "1" of "; 1CO"
REF = re.compile(rf"\b({'|'.join(osis)}) ({SEG}(?:; (?:with )?{SEG})*)")
fixture_refs = kept_refs | outside


def cut_refs(m):
    """The reference list of match `m` with only what the fixture holds, or "" for none."""
    book, segs = osis[m[1]], []
    for seg in re.split(r"; (?:with )?", m[2]):
        ch, _, items = seg.partition(":")
        if not items:
            segs += [ch] if int(ch) in CHAPTERS.get(book, ()) else []
            continue
        kept_items = []
        for item in items.split(","):
            first, _, last = item.partition("-")
            span = range(int(first), int(last or first) + 1) if ":" not in last else []
            if span and all(f"{book}.{ch}.{v}" in fixture_refs for v in span):
                kept_items.append(item)
        segs += [f"{ch}:{','.join(kept_items)}"] if kept_items else []
    return f"{m[1]} {'; '.join(segs)}" if segs else ""


def cut_line(line):
    """The line's text before its first reference, then the references the fixture holds, or
    None when it had references and none are left."""
    matches = list(REF.finditer(line))
    if not matches:
        return line
    refs = [r for r in map(cut_refs, matches) if r]
    return f"{line[: matches[0].start()]}{'; '.join(refs)}" if refs else None


def files_kept_verse(line):
    return any(
        f"{osis[m[1]]}.{ch}.{v}" in kept
        for m in REF.finditer(line)
        for seg in re.split(r"; (?:with )?", m[2])
        for ch, _, items in [seg.partition(":")]
        for item in items.split(",")
        if items and ":" not in item.partition("-")[2]
        for first, _, last in [item.partition("-")]
        for v in range(int(first), int(last or first) + 1)
    )


SEE_ONLY = "ACCOUNTABILITY"  # a heading with only "See" lines (decision 61)
# Synthetic: a range across chapters and a verse that does not exist (Genesis 11 has 32).
NAVES_SYNTHETIC = {"BIRTHRIGHT": "-Synthetic test line GEN 25:33-26:1; 11:33"}
with open(src / NAVES, encoding="utf-8-sig", newline="") as f:
    naves = list(csv.DictReader(f))
out = io.StringIO()
writer = csv.DictWriter(out, ["section", "subject", "entry"], lineterminator="\n")
writer.writeheader()
for r in naves:
    lines = r["entry"].split("\n")
    if r["subject"] != SEE_ONLY and not any(map(files_kept_verse, lines)):
        continue
    lines = [cut_line(line) for line in lines]
    lines = [line for line in lines if line is not None]
    if r["subject"] in NAVES_SYNTHETIC:
        lines.append(NAVES_SYNTHETIC[r["subject"]])
    r["entry"] = "\n".join(lines)
    writer.writerow(r)
# Synthetic headings: spelt two ways and surname first (decision 169), and matching a curated
# alias and a BSB name (decision 172).
for subject, entry in [
    ("ABRAHAMUS (ABRAHAM)", "-Synthetic test heading spelt two ways GEN 25:5"),
    ("ANTIPAS, HEROD", "-Synthetic test heading written surname first GEN 25:5"),
    ("HAGAR THE EGYPTIAN", "-Synthetic test heading matching a curated alias GEN 16:1"),
    ("OHOLIBAMAH", "-Synthetic test heading matching a BSB name GEN 36:2"),
]:
    writer.writerow({"section": "S", "subject": subject, "entry": entry})
(dest / NAVES).write_text(out.getvalue(), encoding="utf-8-sig")

for zip_path in sorted(src.glob("*.zip")):
    if zip_path.name == "cross-references.zip":
        continue
    txt = zip_path.stem + ".txt"
    with zipfile.ZipFile(zip_path) as z:
        lines = [
            x
            for x in z.read(txt).decode().splitlines(True)
            if x.split("\t")[0] in cited["geonames"]
        ]
    with zipfile.ZipFile(dest / zip_path.name, "w") as z:
        z.writestr(zipfile.ZipInfo(txt, date_time=(1980, 1, 1, 0, 0, 0)), "".join(lines))
