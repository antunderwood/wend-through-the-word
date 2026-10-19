"""OpenBible.info coordinates for Places. Adds `lat`, `lon`, `confidence`, `coord_source`.

A Theographic place joins its OpenBible ancient record through the links in Theographic's
`bible-places.geojson` (decision 56). The point is the first resolution with a `lonlat` of the
first (best) identification; there is no fall back to a lower one. Its confidence is that
identification's `score.time_total` (decision 60). Theographic coordinates never ship (decision 41).
"""

import json

THEO_PLACE, OB_ANCIENT = "theographic.netlify.app/place/", "openbible.info/geo/ancient/"


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

    b.new_report("no_coordinate", "place", "openbible", "cause")
    for e in b.entities.values():
        if e["type"] != "place":
            continue
        ob_ids = links.get(e["id"].split(":", 1)[1], [])
        found = openbible_point(ob_ids, ancient, modern)
        if isinstance(found, str):
            b.report("no_coordinate", place=e["id"], openbible=" ".join(ob_ids), cause=found)
            continue
        rec, confidence = found
        lon, lat = map(float, rec["lonlat"].split(","))
        e.update(lat=lat, lon=lon, confidence=confidence, coord_source="OpenBible")


def openbible_point(ob_ids, ancient, modern):
    """(modern record, confidence) of a place's CC BY OpenBible point, or why it has none."""
    if not ob_ids:
        return "no OpenBible link"
    if len(ob_ids) > 1:  # 3 places link to two records; nothing says which (decision 65)
        return "more than one OpenBible record"
    best = ancient[ob_ids[0]]["identifications"][0]
    res = next((r for r in best.get("resolutions", []) if "lonlat" in r), None)
    if res is None:  # a "special" identification, such as not_a_place
        return "OpenBible gives no point"
    rec = modern[res["modern_basis_id"]]
    return drop_cause(rec, modern) or (rec, best["score"]["time_total"])


def drop_cause(rec, modern):
    """Why a modern record's point may not ship, or None (decisions 10, 39, 40, 57).
    A record with no `coordinates_source` takes its point from its `root` record, so the root
    is checked too."""
    source = rec.get("coordinates_source", {}).get("type")
    if source == "osm":
        return "OpenBible point dropped: OpenStreetMap"
    if "custom_lonlat" in rec:  # the readme's sign of a commercial source; never read its value
        return "OpenBible point dropped: commercial"
    if source in ("google_maps", "google_earth_community"):
        return "OpenBible point dropped: Google"
    if rec.get("geometry_credit") == "osm":  # the point may be computed from that geometry
        return "OpenBible point dropped: OpenStreetMap geometry"
    if source is None:
        return drop_cause(modern[rec["root"]["id"]], modern)
