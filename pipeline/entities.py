"""People, Places, Events, and People Groups from Theographic. Sets `b.entities` (ID -> Entity)
and `b.verse_sets` (ID -> whole-Bible Verse Keys, for each Entity in the book range).

Theographic decides identity: one record is one Entity, and no two are merged (decision 7).
An Entity is in the book range when one of its `verses` is.
"""

import json
import re
import sys
from collections import Counter

# type: (source name, function giving the part of the ID after the type prefix)
TYPES = {
    "person": ("theo-people", lambda f: f["personLookup"]),
    "place": ("theo-places", lambda f: f["placeLookup"]),
    "event": ("theo-events", lambda f: str(f["eventID"])),
    "group": ("theo-peopleGroups", lambda f: f["groupName"].lower().replace(" ", "_")),  # dec. 54
}


def facts(kind, f, titles):
    out = {}
    # Never `dictionaryText`: it has broken characters (spec, user story 25).
    if text := "".join(f.get("dictText") or []).strip():
        out["dictionary_entry"] = {
            "text": re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text),  # links to plain text
            "source": "Easton's Bible Dictionary (1897)",
            "licence": "Public domain (1897)",  # decision 38
        }
    if kind in ("person", "place"):
        out["name"] = f["displayTitle"]  # disambiguated: "Jacob (Israel)" (decision 62)
    if kind == "place":  # decision 65: Luz, an other name of Bethel, finds Bethel
        names = (f.get("aliases") or "").split(",") + [f.get("kjvName") or ""]
        names += [titles.get(r) or "" for r in f.get("otherNames") or []]  # fixture cuts some
        names = {n.strip() for n in names} - {""}
        out["aliases"] = sorted(n for n in names if n.lower() != out["name"].lower())
    if kind == "group":
        out["name"] = f["groupName"]
    if kind == "person":
        out["aliases"] = [a.strip() for a in (f.get("alsoCalled") or "").split(",") if a.strip()]
        out["gender"] = f["gender"]  # Male or Female, as Theographic gives it (decision 50)
    if kind == "event":
        out["title"] = f["title"]
        # Astronomical numbering, kept as is: 4004 BC is -4003. Some dates are "0030-05-01".
        out["event_year"] = int(re.match(r"-?\d+", f["startDate"])[0])
    return out


def load(b):
    b.entities = {}
    b.verse_sets = {}  # Entity ID -> Verse Keys of every Verse it is linked to, in range or not
    for verses in b.chapters.values():
        for verse in verses:
            verse["mentions"] = []
    missing = Counter()  # verse record IDs that are not in Theographic's verses.json
    for kind, (source, name) in TYPES.items():
        records = json.loads(b.source(source).read_text())
        titles = {r["id"]: r["fields"].get("displayTitle") for r in records}
        for r in records:
            f = r["fields"]
            missing.update(v for v in f.get("verses") or [] if v not in b.verse_recs)
            entity_id = f"{kind}:{name(f)}"
            if entity_id in b.entities:
                sys.exit(f"two Theographic records give the ID {entity_id}")
            in_range = [b.verse_recs[v] for v in f.get("verses") or [] if b.verse_recs.get(v)]
            if not in_range:
                continue
            # Whole-Bible Verse set for the Co-mention weight (decision 95). Themes (#12) add
            # their Filed Under Verses here.
            b.verse_sets[entity_id] = {b.rec_keys[v] for v in f["verses"] if v in b.rec_keys}
            theographic = {"source": "Theographic", "licence": b.licence(source)}
            b.entities[entity_id] = {
                "id": entity_id,
                "type": kind,
                **facts(kind, f, titles),
                **theographic,
                "verses": in_range,  # replaced by Verse Neighbours below
            }
            for verse in in_range:
                verse["mentions"].append({"id": entity_id, "edge": "MENTIONS", **theographic})
    for verses in b.chapters.values():
        for verse in verses:
            verse["mentions"].sort(key=lambda m: m["id"])
    for rec, count in missing.items():
        cause = "Theographic mention of a verse record that does not exist (dropped)"
        b.report("verse_mismatches", verse=rec, cause=cause, count=count)

    # Verse Neighbours: weight is the number of other Entities in the Verse (PRD 10.4 rule 2).
    for e in b.entities.values():
        neighbours = [
            {
                "key": v["key"],
                "edge": "MENTIONS",
                "direction": "in",
                "weight": len(v["mentions"]) - 1,
                "source": e["source"],
                "licence": e["licence"],
            }
            for v in e["verses"]
        ]
        e["verses"] = sorted(neighbours, key=lambda n: (-n["weight"], n["key"]))
