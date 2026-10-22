"""Explicit relationship edges from Theographic fields. Sets `neighbours` on each Entity.

A Neighbour is one other Entity: its ID, type, weight, and `edges`, the list of every edge
between the pair. Each edge keeps its direction read from this Entity: `out` when this Entity
is the edge's source, `in` when the Neighbour is, `both` for an edge with no direction.
"""

from collections import defaultdict

from pipeline import curation
from pipeline.entities import FIELDS, facts, links

DIRECTED = {edge for kind in FIELDS.values() for edge, out in kind.values() if out is not None}
FAMILY = {"PARENT_OF", "SIBLING_OF", "HALF_SIBLING_OF", "PARTNER_OF"}
NO_END = "links to a record that is not in Theographic, so the edge has no clear end"
OUTSIDE = (
    "other end is outside the book range, and only People and People Groups "
    "ship as stubs (decision 51, until M6)"
)


def load(b):
    records = b.records

    b.new_report("dropped_edges", "record", "field", "link", "cause")
    edges = {}  # Edge -> (provenance, record, field, link)
    for x in links(records):
        if x.key.end is None:
            b.report("dropped_edges", record=x.record, field=x.field, link=x.link, cause=NO_END)
            continue
        theographic = {"source": "Theographic", "licence": b.licence(x.source)}
        edges.setdefault(x.key, (theographic, x.record, x.field, x.link))
    for fix in b.links:  # links.csv (#44)
        if fix.add:
            edges[fix.key] = (fix.item, fix.key.start, "links.csv", fix.key.end)
        else:
            edges.pop(fix.key, None)

    # An edge ships when one end is in the book range. The other end, if outside, ships as a
    # stub (its facts and its Neighbours in range, no Verses) only when it is a Person reached
    # by a family edge or a People Group reached by MEMBER_OF. Other edges are dropped until M6
    # (decision 51 and its note).
    in_range = set(b.entities)
    edges = {k: v for k, v in edges.items() if {k.start, k.end} & in_range}
    stubs = {
        end
        for x, edge, y in edges
        for end in (x, y)
        if end not in in_range and (edge in FAMILY or edge == "MEMBER_OF" and end == y)
    }
    for key, (_, record, field, link) in list(edges.items()):
        if not {key.start, key.end} <= in_range | stubs:
            b.report("dropped_edges", record=record, field=field, link=link, cause=OUTSIDE)
            del edges[key]
    by_id = {r[3]: r for r in records.values()}
    for end in stubs:
        kind, source, f, _ = by_id[end]
        b.entities[end] = {
            "id": end,
            "type": kind,
            **facts(kind, f, b.titles),
            "source": "Theographic",
            "licence": b.licence(source),
            "verses": [],
        }
        curation.correct(b, b.entities[end])

    b.new_report("uncurated_partners", "man_id", "woman_id")
    neighbours = defaultdict(lambda: defaultdict(list))  # Entity ID -> Neighbour ID -> edges

    def add(x, y, item, directed):
        neighbours[x][y].append({**item, "direction": "out" if directed else "both"})
        neighbours[y][x].append({**item, "direction": "in" if directed else "both"})

    for (x, edge, y), (provenance, *_) in sorted(edges.items()):
        item = {"edge": edge, **provenance}
        if edge == "PARENT_OF":
            item["role"] = "father" if b.entities[x]["gender"] == "Male" else "mother"
        if edge == "PARTNER_OF" and (x, y) in b.partners:  # x < y for an edge with no direction
            for curated in b.partners[x, y]:
                add(*curated)
            continue
        if edge == "PARTNER_OF":  # Theographic has no pair of the same gender
            man, woman = (x, y) if b.entities[x]["gender"] == "Male" else (y, x)
            b.report("uncurated_partners", man_id=man, woman_id=woman)
        add(x, y, item, edge in DIRECTED)
    for x, y, item, directed in b.possibly_same:
        if {x, y} <= b.entities.keys():
            add(x, y, item, directed)
        else:
            b.report("dropped_edges", record=x, field="possibly_same.csv", link=y, cause=OUTSIDE)

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
