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
import urllib.request
from pathlib import Path

THEO = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json"
STEP = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns"
GEO = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data"
TIPNR = (
    "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt"
)

# name: (url, licence). The file name is the last part of the URL.
# ponytail: Pleiades, Wikidata, and GeoNames lookups are added in M2, when the coordinate step needs them.
SOURCES = {
    "bsb": ("https://bereanbible.com/bsb.txt", "CC0 1.0"),
    "crossrefs": ("https://a.openbible.info/data/cross-references.zip", "CC BY 4.0"),
    **{
        f"theo-{t}": (f"{THEO}/{t}.json", "CC BY-SA 4.0")
        for t in ("books", "verses", "people", "places", "events", "peopleGroups", "easton")
    },
    **{f"geo-{t}": (f"{GEO}/{t}.jsonl", "CC BY 4.0") for t in ("ancient", "modern", "source")},
    "tipnr": (f"{STEP}/{TIPNR.replace(' ', '%20')}", "CC BY 4.0"),
    "naves": (
        "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/NavesTopicalDictionary.csv",
        "CC BY 4.0",
    ),
}


def file_name(url):
    return urllib.request.url2pathname(url.rsplit("/", 1)[1])


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
                req = urllib.request.Request(url, headers={"User-Agent": "wend-through-the-word"})
                with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
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
