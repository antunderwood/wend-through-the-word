"""Fetch every source and record its URL, date, and SHA-256 in sources/manifest.json.

Usage:
    python -m pipeline.download                     fetch every source
    python -m pipeline.download --supply NAME FILE  record a file fetched by hand (blocked host)
"""

import argparse
import csv
import datetime
import hashlib
import json
import shutil
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

THEO = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json"
STEP = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns"
GEO = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data"
TIPNR = (
    "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt"
)
TVTMS = (
    "TVTMS - Translators Versification Traditions with Methodology for Standardisation for "
    "Eng+Heb+Lat+Grk+Others - STEPBible.org CC BY.txt"
)
# Aquifer Open Bible Dictionary (Tyndale, adapted by Mission Mutual), English JSON, pinned to a
# commit. The articles come in 26 files; each is a source of its own, as GeoNames' countries are.
AOBD = (
    "https://raw.githubusercontent.com/BibleAquifer/AquiferOpenBibleDictionary/"
    "663a34ef9c4edfeff17c8dda22f5f926a8b41f90/eng/json"
)
AOBD_FILES = 26
# UBS Bible Routes (Project MARBLE), pinned to a commit. The repository is 835 MB, so the build's
# zip is made from the route files the curated routes table names (decision 220).
UBS_ROUTES = (
    "https://raw.githubusercontent.com/ubsicap/ubs-open-license/"
    "a15a96cfaa4ca18a6c0339016645ba1e534db3c8/ubs-bible-routes/GeoJsonRoutes"
)
ROUTES_TABLE = Path(__file__).parent / "curated" / "routes.csv"
PLEIADES = "https://atlantides.org/downloads/pleiades/dumps"
WIKIDATA = "https://query.wikidata.org/sparql"
# GeoNames files for the Bible lands, one per country; the whole world file is 422 MB.
# "no-country" holds seas and regions such as the Arabian Peninsula.
GEONAMES = [
    "IL",
    "PS",
    "JO",
    "LB",
    "SY",
    "IQ",
    "IR",
    "EG",
    "SD",
    "ET",
    "ER",
    "SA",
    "YE",
    "OM",
    "KW",
    "TR",
    "CY",
    "GR",
    "IT",
    "MT",
    "LY",
    "ES",
    "no-country",
]

# name: (url, licence). The file name is the last part of the URL, or in FILE_NAMES.
SOURCES = {
    "bsb": ("https://bereanbible.com/bsb.txt", "CC0 1.0"),
    "crossrefs": ("https://a.openbible.info/data/cross-references.zip", "CC BY 4.0"),
    **{
        f"theo-{t}": (f"{THEO}/{t}.json", "CC BY-SA 4.0")
        for t in ("books", "verses", "people", "places", "events", "peopleGroups", "easton")
    },
    # Links only: joins a Theographic place to its OpenBible record (decision 56).
    "theo-geo": (f"{THEO.removesuffix('/json')}/geo/bible-places.geojson", "CC BY-SA 4.0"),
    **{f"geo-{t}": (f"{GEO}/{t}.jsonl", "CC BY 4.0") for t in ("ancient", "modern", "source")},
    "tipnr": (f"{STEP}/{TIPNR.replace(' ', '%20')}", "CC BY 4.0"),
    # Check only (decision 217): People, Places and Groups tagged in the original languages, with
    # the Theographic record IDs they match. A release tag, so the download is pinned.
    "acai": (
        "https://github.com/BibleAquifer/ACAI/archive/refs/tags/v2026-10-30.zip",
        "CC BY-SA 4.0",
    ),
    # Moves each source's verse references into KJV numbering (decision 216).
    "tvtms": (
        f"{STEP.removesuffix('Proper%20Nouns')}Versification/{TVTMS.replace(' ', '%20')}",
        "CC BY 4.0",
    ),
    "naves": (
        "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/NavesTopicalDictionary.csv",
        "CC BY 4.0",
    ),
    # Dictionary Entries for Themes (decision 219).
    **{
        f"aobd-{n:03d}": (f"{AOBD}/{n:03d}.content.json", "CC BY-SA 4.0")
        for n in range(1, AOBD_FILES + 1)
    },
    # Journey lines for the map (decision 220): one zip of the GeoJSON files in routes.csv.
    "ubs-routes": (UBS_ROUTES, "CC BY-SA 4.0"),
    # Lookups for Places whose OpenBible point is dropped (record "OpenStreetMap coordinates").
    # Pleiades locations, not places: a place's point blends in its OpenStreetMap locations.
    "pleiades-locations": (f"{PLEIADES}/pleiades-locations-latest.csv.gz", "CC BY 3.0"),
    # The P625 statements of the Wikidata items that OpenBible's modern locations cite.
    # Its query is built from geo-modern, so it must come after it.
    "wikidata-coords": (WIKIDATA, "CC0 1.0"),
    **{
        f"geonames-{c}": (f"https://download.geonames.org/export/dump/{c}.zip", "CC BY 4.0")
        for c in GEONAMES
    },
}
# The versification of each source's verse references (decision 216; schemes in
# pipeline/versification.py). The Verse Key is KJV versification, so "kjv" moves nothing.
VERSIFICATION = {
    "bsb": "niv",  # Philippians 1:16 and 17 in the Greek order; checked on BibleAquifer's BSB
    "crossrefs": "esv",  # OpenBible.info numbers verses as the ESV does
    "theo-verses": "kjv",
    "tipnr": "kjv",  # with Psalm titles as verse 0
    "naves": "kjv",
    "acai": "original",  # Hebrew numbering in the Old Testament, SBLGNT in the New
    # English numbering (it cites Malachi 4, which Hebrew numbering lacks). Its references stay
    # in its text as written and the build joins none of them, so nothing is moved.
    **{f"aobd-{n:03d}": "kjv" for n in range(1, AOBD_FILES + 1)},
    # The routes carry no references; their passages are in our routes table, in KJV numbering.
    "ubs-routes": "kjv",
}
FILE_NAMES = {
    WIKIDATA: "wikidata-coords.json",
    SOURCES["acai"][0]: "acai-v2026-10-30.zip",
    UBS_ROUTES: "ubs-routes.zip",
    **{SOURCES[f"aobd-{n:03d}"][0]: f"aobd-{n:03d}.json" for n in range(1, AOBD_FILES + 1)},
}
QUERY_FILE = "wikidata-query.sparql"  # saved next to its result, so it can be run again
HEADERS = {"User-Agent": "wend-through-the-word (github.com/antunderwood/wend-through-the-word)"}
# Every coordinate statement with its rank and references, and the Pleiades and GeoNames IDs.
WIKIDATA_QUERY = """SELECT ?item ?st ?lat ?lon ?rank ?refProp ?refVal ?pleiades ?geonames WHERE {
  VALUES ?item { %s }
  OPTIONAL { ?item wdt:P1584 ?pleiades . }
  OPTIONAL { ?item wdt:P1566 ?geonames . }
  OPTIONAL {
    ?item p:P625 ?st . ?st psv:P625 ?v ; wikibase:rank ?rank .
    ?v wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
    OPTIONAL { ?st prov:wasDerivedFrom ?ref . ?ref ?refProp ?refVal . }
  }
}"""


def file_name(url):
    return FILE_NAMES.get(url) or urllib.request.url2pathname(url.rsplit("/", 1)[1])


def wikidata_ids(dest):
    """The Wikidata items that OpenBible's modern locations cite, as their source or as a
    secondary source. Read from the downloaded file, so they do not depend on the build."""
    ids = set()
    for line in (dest / file_name(SOURCES["geo-modern"][0])).read_text().splitlines():
        rec = json.loads(line)
        for ref in [rec.get("coordinates_source", {}), *rec.get("secondary_sources", [])]:
            if ref.get("type") == "wikidata":
                ids.add(ref["id"])
    return sorted(ids)


def wikidata_query(dest):
    """The SPARQL query for wikidata-coords. Saved as QUERY_FILE in `dest`."""
    if not (dest / file_name(SOURCES["geo-modern"][0])).exists():
        sys.exit("wikidata-coords: its query is built from geo-modern, so get geo-modern first")
    query = WIKIDATA_QUERY % " ".join(f"wd:{q}" for q in wikidata_ids(dest))
    (dest / QUERY_FILE).write_text(query)
    return query


def request(name, url, dest):
    if name != "wikidata-coords":
        return urllib.request.Request(url, headers=HEADERS)
    query = wikidata_query(dest)
    headers = HEADERS | {"Accept": "application/sparql-results+json"}
    return urllib.request.Request(url, urllib.parse.urlencode({"query": query}).encode(), headers)


def route_files():
    """The route files the curated routes table names, in its order."""
    with open(ROUTES_TABLE, newline="", encoding="utf-8") as f:
        return [row["file"] for row in csv.DictReader(f)]


def fetch_routes(path):
    """Fetch each route file into one zip, its entries dated 1980 so the same files give the same
    bytes and checksum."""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name in route_files():
            url = f"{UBS_ROUTES}/{urllib.parse.quote(name)}.geojson"
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=HEADERS), timeout=120
            ) as r:
                info = zipfile.ZipInfo(f"{name}.geojson", date_time=(1980, 1, 1, 0, 0, 0))
                z.writestr(info, r.read(), zipfile.ZIP_DEFLATED)


def record(manifest, name, path, how):
    url, licence = SOURCES[name]
    manifest[name] = {
        "url": url,
        "file": path.name,
        "licence": licence,
        "how": how,
        "date": datetime.date.today().isoformat(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    if name == "wikidata-coords":  # PRD 9 rule 3: the query too, so the file can be fetched again
        query = wikidata_query(path.parent).encode()
        manifest[name] |= {"query": QUERY_FILE, "query_sha256": hashlib.sha256(query).hexdigest()}


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--dest", type=Path, default=Path("sources"))
    p.add_argument("--supply", nargs=2, metavar=("NAME", "FILE"))
    args = p.parse_args(argv)

    for name, (_, licence) in SOURCES.items():
        if "NC" in licence:
            sys.exit(
                f"{name}: {licence} is non-commercial; no CC BY-NC source may enter the dataset"
            )

    args.dest.mkdir(parents=True, exist_ok=True)
    manifest_path = args.dest / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    failed = []

    if args.supply:
        name, src = args.supply
        if name not in SOURCES:
            sys.exit(f"unknown source {name!r}; one of: {', '.join(SOURCES)}")
        path = args.dest / file_name(SOURCES[name][0])
        shutil.copyfile(src, path)
        record(manifest, name, path, "supplied by owner")
    else:
        for name, (url, _) in SOURCES.items():
            path = args.dest / file_name(url)
            print(f"{name}: {url}")
            try:
                if name == "ubs-routes":
                    fetch_routes(path)
                    record(manifest, name, path, "downloaded")
                    continue
                req = request(name, url, args.dest)
                with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
                    shutil.copyfileobj(r, f)
            except OSError as e:
                failed.append(f"{name}: {e}")
                continue
            old = manifest.get(name, {}).get("sha256")
            record(manifest, name, path, "downloaded")
            if old and old != manifest[name]["sha256"]:
                print("  changed since last download")

    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    if failed:
        sys.exit("failed (supply these by hand with --supply):\n" + "\n".join(failed))


if __name__ == "__main__":
    main()
