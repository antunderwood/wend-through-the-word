"""Explicit relationship edges from Theographic fields. Sets `neighbours` on each Entity.

A Neighbour is one other Entity: its ID, type, weight, and `edges`, the list of every edge
between the pair. Each edge keeps its direction read from this Entity: `out` when this Entity
is the edge's source, `in` when the Neighbour is, `both` for an edge with no direction.
"""

import json
from collections import defaultdict

from pipeline.entities import TYPES, facts

# Theographic field: (edge, True when the record holding the field is the edge's source, None
# when the edge has no direction).
FIELDS = {
    "person": {
        "father": ("PARENT_OF", False),
        "mother": ("PARENT_OF", False),
        "children": ("PARENT_OF", True),
        "siblings": ("SIBLING_OF", None),
        # Only from these fields, never from shared parents (decision 36).
        "halfSiblingsSameFather": ("HALF_SIBLING_OF", None),
        "halfSiblingsSameMother": ("HALF_SIBLING_OF", None),
        "partners": ("PARTNER_OF", None),  # every pair for now; curated later (#7)
        "birthPlace": ("BORN_AT", True),
        "deathPlace": ("DIED_AT", True),
        "memberOf": ("MEMBER_OF", True),
    },
    "event": {
        "participants": ("PARTICIPATED_IN", False),
        "locations": ("OCCURRED_AT", True),
    },
}
DIRECTED = {edge for kind in FIELDS.values() for edge, out in kind.values() if out is not None}
FAMILY = {"PARENT_OF", "SIBLING_OF", "HALF_SIBLING_OF", "PARTNER_OF"}
NO_END = "links to a record that is not in Theographic, so the edge has no clear end"
OUTSIDE = (
    "other end is outside the book range, and only People and People Groups "
    "ship as stubs (decision 51, until M6)"
)


def load(b):
    records = {}  # record ID -> (type, source name, fields, Entity ID)
    for kind, (source, name) in TYPES.items():
        for r in json.loads(b.source(source).read_text()):
            records[r["id"]] = (kind, source, r["fields"], f"{kind}:{name(r['fields'])}")

    b.new_report("dropped_edges", "record", "field", "link", "cause")
    # (from, edge, to) -> (licence, record, field, link); an edge with no direction has from < to
    edges = {}
    for kind, source, f, a in records.values():
        for field, (edge, out) in FIELDS.get(kind, {}).items():
            for rec in f.get(field) or []:
                if rec not in records:
                    b.report("dropped_edges", record=a, field=field, link=rec, cause=NO_END)
                    continue
                c = records[rec][3]
                x, y = (a, c) if out or (out is None and a < c) else (c, a)
                edges.setdefault((x, edge, y), (b.licence(source), a, field, c))

    # An edge ships when one end is in the book range. The other end, if outside, ships as a
    # stub (its facts and its Neighbours in range, no Verses) only when it is a Person reached
    # by a family edge or a People Group reached by MEMBER_OF. Other edges are dropped until M6
    # (decision 51 and its note).
    in_range = set(b.entities)
    edges = {k: v for k, v in edges.items() if {k[0], k[2]} & in_range}
    stubs = {
        end
        for x, edge, y in edges
        for end in (x, y)
        if end not in in_range and (edge in FAMILY or edge == "MEMBER_OF" and end == y)
    }
    for key, (_, record, field, link) in list(edges.items()):
        if not {key[0], key[2]} <= in_range | stubs:
            b.report("dropped_edges", record=record, field=field, link=link, cause=OUTSIDE)
            del edges[key]
    by_id = {r[3]: r for r in records.values()}
    titles = {rec: r[2].get("displayTitle") for rec, r in records.items()}
    for end in stubs:
        kind, source, f, _ = by_id[end]
        b.entities[end] = {
            "id": end,
            "type": kind,
            **facts(kind, f, titles),
            "source": "Theographic",
            "licence": b.licence(source),
            "verses": [],
        }

    b.new_report("uncurated_partners", "man_id", "woman_id")
    neighbours = defaultdict(lambda: defaultdict(list))  # Entity ID -> Neighbour ID -> edges
    for (x, edge, y), (licence, *_) in sorted(edges.items()):
        item = {"edge": edge, "source": "Theographic", "licence": licence}
        if edge == "PARENT_OF":
            item["role"] = "father" if b.entities[x]["gender"] == "Male" else "mother"
        if edge == "PARTNER_OF":  # Theographic has no pair of the same gender
            man, woman = (x, y) if b.entities[x]["gender"] == "Male" else (y, x)
            b.report("uncurated_partners", man_id=man, woman_id=woman)
        directed = edge in DIRECTED
        neighbours[x][y].append({**item, "direction": "out" if directed else "both"})
        neighbours[y][x].append({**item, "direction": "in" if directed else "both"})

    for e in b.entities.values():
        e["neighbours"] = [
            {
                "id": n,
                "type": b.entities[n]["type"],
                "weight": 0,  # explicit edges have no weight of their own (prototype)
                "edges": sorted(items, key=lambda i: i["edge"]),
            }
            for n, items in sorted(neighbours[e["id"]].items())
        ]
