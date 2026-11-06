"""Bible routes for the map (decision 220): UBS's journey lines (Project MARBLE, drawn for UBS by
Leen Ritmeyer, CC BY-SA 4.0), joined to Verses by the curated `routes.csv`. Runs after every step
that links Entities to Verses. Sets `b.routes`, which `export` writes as `routes.json`.

A route file holds only a line, so each row of `routes.csv` gives the route's title and passage
(OSIS references or ranges in KJV numbering, joined with ";"). A row ships when it is reviewed
("yes") and its passage has a Verse in the book range. A row marked "unsure" ships too, flagged
`unreviewed`, so the map can say its match is a guess (decision 224). Each Person, Place and Event named in a
shipped route's passage (in the whole Bible) lists the route in `routes`, most shared Verses
first. Coordinates are rounded to four decimals (about 10 m).
"""

import csv
import json
import sys
import zipfile
from bisect import bisect_left, bisect_right
from collections import Counter
from pathlib import Path

ON_ROUTES = ("person", "place", "event")


def table(b):
    folder = Path(b.cfg.get("curated") or Path(__file__).parent / "curated")
    with open(folder / "routes.csv", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def passage_keys(b, passage, keys):
    """The Verse Keys of a passage, or None when a reference is not a Verse."""
    found = []
    for part in passage.split(";"):
        first, _, last = part.strip().partition("-")
        start, end = b.verse_keys.get(first), b.verse_keys.get(last or first)
        if not (start and end):
            return None
        found += keys[bisect_left(keys, start) : bisect_right(keys, end)]
    return found


def lines(geojson):
    """Every line of a route file as [[lon, lat], ...], rounded. Empty features are skipped."""
    data = json.loads(geojson)
    out = []
    for f in data["features"] if data["type"] == "FeatureCollection" else [data]:
        g = (f or {}).get("geometry")
        if not g:
            continue
        parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        out += [[[round(x, 4), round(y, 4)] for x, y, *_ in part] for part in parts]
    return out


def load(b):
    rows = table(b)
    keys = sorted(set(b.verse_keys.values()))
    in_range = {v["key"] for vs in b.chapters.values() for v in vs}
    labels = {k: osis for osis, k in b.verse_keys.items()}
    b.new_report("routes", "id", "file", "reviewed", "shipped", "verses", "listed_on")
    b.routes = []
    errors = []
    with zipfile.ZipFile(b.source("ubs-routes")) as z:
        names = set(z.namelist())
        for row in rows:
            verses = passage_keys(b, row["passage"], keys)
            if verses is None:
                errors.append(f"{row['id']}: {row['passage']} is not a passage of Verses")
                continue
            if f"{row['file']}.geojson" not in names:
                errors.append(f"{row['id']}: no file {row['file']}.geojson in ubs-routes")
                continue
            ship = row["reviewed"] in ("yes", "unsure") and bool(in_range.intersection(verses))
            listed = Counter()
            if ship:
                for e in b.entities.values():
                    n = len(b.verse_sets.get(e["id"], set()).intersection(verses))
                    if e["type"] in ON_ROUTES and n:
                        listed[e["id"]] = n
                for entity_id, n in listed.items():
                    b.entities[entity_id].setdefault("route_counts", []).append((n, row["id"]))
                b.routes.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "passage": row["passage"],
                        "verses": [labels[k] for k in verses if k in in_range],
                        "lines": lines(z.read(f"{row['file']}.geojson")),
                        "source": "UBS Bible Routes",
                        "licence": b.licence("ubs-routes"),
                        **({"unreviewed": True} if row["reviewed"] == "unsure" else {}),
                    }
                )
            b.report("routes", id=row["id"], file=row["file"], reviewed=row["reviewed"],
                     shipped="yes" if ship else "", verses=len(verses),
                     listed_on=len(listed))  # fmt: skip
    if errors:
        sys.exit("routes.csv: rows that do not parse\n" + "\n".join(errors))
    for e in b.entities.values():
        if counts := e.pop("route_counts", None):
            e["routes"] = [i for _, i in sorted(counts, key=lambda c: (-c[0], c[1]))]
