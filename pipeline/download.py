"""Fetch every source and record its URL, date, and SHA-256 in sources/manifest.json.

Usage:
    python -m pipeline.download                     fetch every source
    python -m pipeline.download --supply NAME FILE  record a file fetched by hand (blocked host)
"""

import argparse
import datetime
import hashlib
import json
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path

THEO = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json"
STEP = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns"
GEO = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data"
TIPNR = (
    "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt"
)
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
    "naves": (
        "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/NavesTopicalDictionary.csv",
        "CC BY 4.0",
    ),
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
FILE_NAMES = {WIKIDATA: "wikidata-coords.json"}
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


def request(name, url, dest):
    if name != "wikidata-coords":
        return urllib.request.Request(url, headers=HEADERS)
    query = WIKIDATA_QUERY % " ".join(f"wd:{q}" for q in wikidata_ids(dest))
    headers = HEADERS | {"Accept": "application/sparql-results+json"}
    return urllib.request.Request(url, urllib.parse.urlencode({"query": query}).encode(), headers)


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
