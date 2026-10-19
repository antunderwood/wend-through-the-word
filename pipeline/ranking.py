"""CO_MENTION edges between Entities that share a Verse, weighted by the cosine score, then the
Neighbour ranking, Overflow counts, and Ring 2 of each Entity (PRD 10.4).

The Verse set of an Entity is the Verse Keys in its `verses` list. That list holds its Mention
Verses; Themes (#12) add their Filed Under Verses there, in a step that runs before this one.
"""

import math
from collections import Counter, defaultdict
from itertools import combinations

from pipeline.crossrefs import RING2_TOP

K = 6  # default number of Neighbours of each type in Ring 1 (PRD 10.4 rule 1)


def load(b):
    in_verse = defaultdict(list)  # Verse Key -> IDs of the Entities in it
    for e in b.entities.values():
        for v in e["verses"]:
            in_verse[v["key"]].append(e["id"])
    shared = Counter()  # (ID, ID) -> number of shared Verses
    for ids in in_verse.values():
        shared.update(combinations(sorted(ids), 2))

    # Source and licence of each Entity's Verse links: Mentions, and Filed Under once Themes ship
    provenance = {
        e["id"]: {(v["source"], v["licence"]) for v in e["verses"]} for e in b.entities.values()
    }
    neighbours = {e["id"]: {n["id"]: n for n in e["neighbours"]} for e in b.entities.values()}
    for (x, y), n in sorted(shared.items()):
        sources = provenance[x] | provenance[y]
        item = {
            "edge": "CO_MENTION",
            "direction": "both",
            "shared_verses": n,
            "source": "; ".join(sorted({s for s, _ in sources})),
            "licence": "; ".join(sorted({lic for _, lic in sources})),
        }
        verses_x, verses_y = len(b.entities[x]["verses"]), len(b.entities[y]["verses"])
        weight = round(n / math.sqrt(verses_x * verses_y), 4)
        for here, there in ((x, y), (y, x)):
            found = neighbours[here].get(there)
            if not found:
                found = {"id": there, "type": b.entities[there]["type"], "edges": []}
                neighbours[here][there] = found
                b.entities[here]["neighbours"].append(found)
            found["weight"] = weight
            found["edges"] = sorted(found["edges"] + [item], key=lambda i: i["edge"])

    # Rank: explicit relationship edges first, then weight descending, then ID (PRD 10.4 rule 2).
    for e in b.entities.values():
        e["neighbours"].sort(key=lambda n: (not explicit(n), -n["weight"], n["id"]))
        types = Counter(n["type"] for n in e["neighbours"]) + Counter(verse=len(e["verses"]))
        e["overflow"] = {t: max(0, count - K) for t, count in types.items()}

    # Ring 2: the top Neighbours of each Ring 1 node, as ID and weight. An Entity's come from
    # its Entity Neighbours, a Verse's from its cross-references, so that no list ranks weights
    # of two scales together (decision 33).
    verses = {v["key"]: v for vs in b.chapters.values() for v in vs}
    for e in b.entities.values():
        ring1 = [v["key"] for v in e["verses"][:K]]
        for t in {n["type"] for n in e["neighbours"]}:
            ring1 += [n["id"] for n in e["neighbours"] if n["type"] == t][:K]
        e["ring2"] = {node: top(b, verses, node) for node in ring1}


def explicit(n):
    return any(i["edge"] != "CO_MENTION" for i in n["edges"])


def top(b, verses, node):
    ranked = (
        b.entities[node]["neighbours"] if node in b.entities else verses[node]["cross_references"]
    )
    return [{"id": n["id"], "weight": n["weight"]} for n in ranked[:RING2_TOP]]
