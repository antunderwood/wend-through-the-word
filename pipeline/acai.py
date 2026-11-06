"""The ACAI check (decision 217, #128). ACAI (BiblioNexus, CC BY-SA 4.0) tags People, Places and
People Groups in the original-language text, and gives each record the Theographic record IDs it
matches (`alternate_sources.vizbible`). Like TIPNR (decision 7), it is read to check the data:
nothing from it reaches the export.

For each Person, Place and People Group in the book range it reports:
- `acai_disagreements`: no ACAI record names it, or several do (`identity`); and, for People,
  family links where the two disagree (`father`, `mother`, `siblings`, `partners`, `children`),
  by the TIPNR rule: one side naming no one is a gap, not a disagreement (decision 86).
- `acai_mentions`: Verses in the book range that one side links to it and the other does not.
  ACAI's references are in original-language numbering, so they move into KJV numbering first
  (decision 216).
- `acai_crosswalk`: the ACAI record of each Entity, with ACAI's TIPNR, UBS and Aquifer IDs, for
  later work that joins by them.
"""

import json
import re
import zipfile
from collections import defaultdict

from pipeline.tipnr import links

FOLDERS = {"people": "person", "places": "place", "groups": "group"}
ACAI_FIELDS = {"father": "father", "mother": "mother", "siblings": "siblings",
               "partners": "partners", "offspring": "children"}  # fmt: skip


def records(path):
    """Every ACAI person, place and group record in the release zip."""
    out = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            m = re.fullmatch(r"[^/]+/(people|places|groups)/json/[^/]+\.json", name)
            if m:
                out.append(json.loads(z.read(name)))
    return out


def as_list(value):
    return value if isinstance(value, list) else [value] if value else []


def load(b):
    order = {v["order"]: osis for osis, v in b.books.items()}

    def verse_key(ref):
        """An ACAI reference (BBCCCVVV, original numbering) as a Verse Key, or None."""
        book = order.get(int(ref[:2]))
        osis = b.to_kjv("acai", f"{book}.{int(ref[2:5])}.{int(ref[5:])}") if book else None
        return b.verse_keys.get(osis)

    entity_of = {rec: r[3] for rec, r in b.records.items()}
    by_entity = defaultdict(list)  # Theographic Entity ID -> ACAI records that name it
    acai_entity = defaultdict(set)  # ACAI ID -> Theographic Entity IDs
    for r in records(b.source("acai")):
        for rec in (r.get("alternate_sources") or {}).get("vizbible", []):
            if rec in entity_of:
                by_entity[entity_of[rec]].append(r)
                acai_entity[r["id"]].add(entity_of[rec])

    in_range = {v["key"]: v["label"] for vs in b.chapters.values() for v in vs}
    b.new_report("acai_disagreements", "entity", "acai_id", "field", "theographic", "acai")
    b.new_report("acai_mentions", "verse", "entity", "acai_id", "only_in")
    b.new_report("acai_crosswalk", "entity", "acai_id", "tipnr", "ubs", "aquifer")

    for e in b.entities.values():
        if e["type"] not in FOLDERS.values() or not e["verses"]:
            continue
        found = by_entity.get(e["id"], [])
        acai_ids = ", ".join(sorted(r["id"] for r in found))
        if len(found) != 1:  # none, or ACAI has several records where Theographic has one
            b.report("acai_disagreements", entity=e["id"], acai_id=acai_ids, field="identity",
                     theographic=e["id"], acai=acai_ids)  # fmt: skip
        if not found:
            continue
        for r in found:
            alt = r.get("alternate_sources") or {}
            b.report("acai_crosswalk", entity=e["id"], acai_id=r["id"],
                     tipnr=", ".join(alt.get("tipnr", [])),
                     ubs=", ".join(alt.get("ubsdbh", []) + alt.get("ubsdgnt", [])),
                     aquifer=", ".join(a.split("|")[0] for a in alt.get("aquifer", [])))  # fmt: skip

        theirs = {k for r in found for k in map(verse_key, r.get("references") or []) if k}
        ours = b.verse_sets.get(e["id"], set())
        for key, side in sorted(
            [(k, "Theographic") for k in ours - theirs] + [(k, "ACAI") for k in theirs - ours]
        ):
            if key in in_range:
                b.report("acai_mentions", verse=in_range[key], entity=e["id"], acai_id=acai_ids,
                         only_in=side)  # fmt: skip

        if e["type"] != "person":
            continue
        family = defaultdict(set)  # field -> ACAI IDs as Theographic Entity IDs (or ACAI IDs)
        for r in found:
            for field, ours_field in ACAI_FIELDS.items():
                for a in as_list(r.get(field)):
                    family[ours_field] |= acai_entity.get(a, {a})
        for field, theo in links(e).items():
            if theo and family[field] and theo != family[field]:
                b.report("acai_disagreements", entity=e["id"], acai_id=acai_ids, field=field,
                         theographic=", ".join(sorted(theo)),
                         acai=", ".join(sorted(family[field])))  # fmt: skip
