"""OpenBible.info coordinates for Places. Adds `lat`, `lon`, `confidence`, `coord_source`.

A Theographic place joins its OpenBible ancient record through the links in Theographic's
`bible-places.geojson` (decision 56). The point is the first resolution with a `lonlat` of the
first (best) identification; there is no fall back to a lower one. Its confidence is that
identification's `score.time_total` (decision 60). Theographic coordinates never ship (decision 41).

A dropped point (OpenStreetMap, commercial, or Google) is looked up again, offline, in Pleiades,
then Wikidata, then GeoNames, by the IDs its OpenBible location cites (decisions 82 to 85).
A reviewed `coordinates` row in the curated corrections sets or removes a point (decision 89).
"""

import csv
import gzip
import json
import re
import zipfile

from pipeline.download import SOURCES

THEO_PLACE, OB_ANCIENT = "theographic.netlify.app/place/", "openbible.info/geo/ancient/"
LOOKUPS = ("Pleiades", "Wikidata", "GeoNames")  # in lookup order; also the `coord_source` values


def link_id(url):
    return url.rstrip("/").rsplit("/", 1)[1]


def jsonl(path):
    return {r["id"]: r for r in map(json.loads, path.read_text().splitlines())}


def load(b):
    links = {}  # Theographic place lookup -> OpenBible ancient IDs
    for f in json.loads(b.source("theo-geo").read_text())["features"]:
        urls = [x["identifier"] for x in f.get("links") or []]
        ob = [link_id(u) for u in urls if OB_ANCIENT in u]
        for u in urls:
            if THEO_PLACE in u:
                links.setdefault(link_id(u), []).extend(ob)
    ancient, modern = jsonl(b.source("geo-ancient")), jsonl(b.source("geo-modern"))
    wikidata = wikidata_items(b.source("wikidata-coords"))

    b.new_report("no_coordinate", "place", "openbible", "cause")
    dropped = []  # (entity, OpenBible IDs, modern record, confidence, drop cause)
    for e in b.entities.values():
        if e["type"] != "place":
            continue
        ob_ids = links.get(e["id"].split(":", 1)[1], [])
        fix = next((r for r in b.corrections.get(e["id"], []) if r["field"] == "coordinates"), None)
        found = openbible_point(ob_ids, ancient, modern, wikidata)
        if fix and fix["value"]:  # the owner's point replaces any other (decision 89)
            lat, lon = map(float, fix["value"].split(","))
            e.update(lat=lat, lon=lon, coord_source="Curated")
        elif fix:
            cause = "point removed by a curated correction"
            b.report("no_coordinate", place=e["id"], openbible=" ".join(ob_ids), cause=cause)
        elif isinstance(found, str):
            b.report("no_coordinate", place=e["id"], openbible=" ".join(ob_ids), cause=found)
        elif found[2]:
            dropped.append((e, ob_ids, *found))
        else:
            rec, confidence, _ = found
            lon, lat = map(float, rec["lonlat"].split(","))
            e.update(lat=lat, lon=lon, confidence=confidence, coord_source="OpenBible")

    # Look dropped points up again (decision record "OpenStreetMap coordinates").
    ids = {e["id"]: lookup_ids(rec, wikidata) for e, _, rec, _, _ in dropped}
    wanted = {s: {i for x in ids.values() for i in x[s]} for s in LOOKUPS}
    points = {  # in lookup order
        "Pleiades": pleiades_points(b.source("pleiades-locations"), wanted["Pleiades"]),
        "Wikidata": {q: item["point"] for q, item in wikidata.items() if item["point"]},
        "GeoNames": geonames_points(
            [b.source(s) for s in SOURCES if s.startswith("geonames-")], wanted["GeoNames"]
        ),
    }
    for e, ob_ids, _, confidence, cause in dropped:
        found = next(
            ((points[s][i], s) for s in LOOKUPS for i in ids[e["id"]][s] if i in points[s]), None
        )
        if found is None:
            b.report("no_coordinate", place=e["id"], openbible=" ".join(ob_ids), cause=cause)
        else:
            (lat, lon), source = found
            e.update(lat=lat, lon=lon, confidence=confidence, coord_source=source)


def openbible_point(ob_ids, ancient, modern, wikidata):
    """(modern record, confidence, drop cause or None) of a place's OpenBible point, or why it
    has none."""
    if not ob_ids:
        return "no OpenBible link"
    if len(ob_ids) > 1:  # 3 places link to two records; nothing says which (decision 66)
        return "more than one OpenBible record"
    best = ancient[ob_ids[0]]["identifications"][0]
    res = next((r for r in best.get("resolutions", []) if "lonlat" in r), None)
    if res is None:  # a "special" identification, such as not_a_place
        return "OpenBible gives no point"
    rec = modern[res["modern_basis_id"]]
    return rec, best["score"]["time_total"], drop_cause(rec, modern, wikidata)


def lookup_ids(rec, wikidata):
    """Pleiades, Wikidata, and GeoNames IDs of the modern location whose point was dropped: its
    own source and secondary sources, then what its Wikidata items link to."""
    refs = [rec.get("coordinates_source", {}), *rec.get("secondary_sources", [])]
    ids = {s: [r["id"] for r in refs if r.get("type") == s.lower()] for s in LOOKUPS}
    for q in ids["Wikidata"]:
        ids["Pleiades"] += sorted(wikidata.get(q, {}).get("pleiades", ()))
        ids["GeoNames"] += sorted(wikidata.get(q, {}).get("geonames", ()))
    return ids


def wikidata_items(path):
    """Wikidata item ID -> its Pleiades IDs and its point, from the saved SPARQL result.
    The point is a coordinate statement that is not deprecated and whose references do not
    cite OpenStreetMap (decision 43), of the best rank; ties go to the lowest (lat, lon)."""
    items, statements = {}, {}
    for row in json.loads(path.read_text())["results"]["bindings"]:
        q = link_id(row["item"]["value"])
        item = items.setdefault(q, {"pleiades": set(), "geonames": set(), "cites_osm": False})
        for key in ("pleiades", "geonames"):
            if key in row:
                item[key].add(row[key]["value"])
        if "st" in row:
            st = statements.setdefault(
                row["st"]["value"],
                {
                    "item": q,
                    "point": (float(row["lat"]["value"]), float(row["lon"]["value"])),
                    "rank": row["rank"]["value"].rsplit("#", 1)[1],
                    "osm": False,
                },
            )
            ref = row.get("refVal", {}).get("value", "")
            st["osm"] |= ref.endswith("/entity/Q936") or "openstreetmap" in ref.lower()
    usable = {}
    for s in statements.values():
        items[s["item"]]["cites_osm"] |= s["osm"]
        if s["rank"] != "DeprecatedRank" and not s["osm"]:
            usable.setdefault(s["item"], []).append((s["rank"] != "PreferredRank", s["point"]))
    for q, item in items.items():
        item["point"] = min(usable[q])[1] if q in usable else None
    return items


def pleiades_points(path, wanted):
    """Pleiades place ID -> mean (lat, lon) of its locations that are not from OpenStreetMap.
    A place's own point blends in its OpenStreetMap locations, so it is not used."""
    csv.field_size_limit(10**9)  # `geometry` holds long GeoJSON strings
    found = {}
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            pid = link_id(row["pid"])
            if pid in wanted and row["reprLat"] and not from_osm(row):
                found.setdefault(pid, []).append((float(row["reprLat"]), float(row["reprLong"])))
    return {
        pid: tuple(round(sum(c) / len(points), 6) for c in zip(*points))
        for pid, points in found.items()
    }


def geonames_points(paths, wanted):
    """GeoNames ID -> (lat, lon), from the per country dump files (tab separated, no header)."""
    found = {}
    for path in paths:
        with zipfile.ZipFile(path) as z:
            for line in z.read(path.stem + ".txt").decode().splitlines():
                gid, _, _, _, lat, lon = line.split("\t", 6)[:6]
                if gid in wanted:
                    found[gid] = (float(lat), float(lon))
    return found


def from_osm(location):
    return (
        location["id"].startswith("osm")
        or re.search(r"\bOSM\b", location["title"], re.IGNORECASE)
        or "openstreetmap" in location["description"].lower()
    )


def drop_cause(rec, modern, wikidata):
    """Why a modern record's point may not ship, or None (decisions 10, 39, 40, 57, 58).
    A record with no `coordinates_source` takes its point from its `root` record, so the root
    is checked too."""
    source, source_id = (rec.get("coordinates_source", {}).get(k) for k in ("type", "id"))
    if source == "osm":
        return "OpenBible point dropped: OpenStreetMap"
    if "custom_lonlat" in rec:  # the readme's sign of a commercial source; never read its value
        return "OpenBible point dropped: commercial"
    if source in ("google_maps", "google_earth_community"):
        return "OpenBible point dropped: Google"
    if rec.get("geometry_credit") == "osm":  # the point may be computed from that geometry
        return "OpenBible point dropped: OpenStreetMap geometry"
    if source == "wikidata" and wikidata.get(source_id, {}).get("cites_osm"):
        # Any of the item's coordinates: nothing says which one OpenBible copied.
        return "OpenBible point dropped: Wikidata cites OpenStreetMap"
    if source is None:
        return drop_cause(modern[rec["root"]["id"]], modern, wikidata)
