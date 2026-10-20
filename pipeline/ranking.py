"""CO_MENTION edges between Entities that share a Verse, weighted by the cosine score (a Theme
neighbour by shared Verses times the rarity of its heading, decision 111), then the
Neighbour ranking, Overflow counts, and Ring 2 of each Entity (PRD 10.4).

The Verse set of an Entity is `b.verse_sets`, across the whole Bible (decision 95), so weights
do not change when the book range grows. A pair needs a shared Verse in the book range, and
`shared_verses` counts only those.
"""

import math
from collections import Counter, defaultdict
from itertools import combinations

from pipeline.common import ring2_entries

RING1_PER_TYPE = 6  # default number of Neighbours of each type in Ring 1, K (PRD 10.4 rule 1)
BIBLE_VERSES = 31102  # Verse Keys in the Bible (PRD 7.1), for the rarity of a Nave's heading


def joined(pairs):
    """Source and licence of an item derived from several (source, licence) pairs. A pair may
    already be joined (a CO_MENTION's), so each is split again."""
    return {
        "source": "; ".join(sorted({x for s, _ in pairs for x in s.split("; ")})),
        "licence": "; ".join(sorted({x for _, lic in pairs for x in lic.split("; ")})),
    }


def cosine_of(n):
    """A Neighbour's CO_MENTION cosine, or 0 when an explicit edge is its only link."""
    return next((e["cosine"] for e in n["edges"] if e["edge"] == "CO_MENTION"), 0)


def rarity(b, entity_id):
    """How rare an Entity is across the Bible (decision 111)."""
    return math.log(BIBLE_VERSES / len(b.verse_sets[entity_id]))


def load(b):
    # A Verse Focus ranks the Entities it mentions or is filed under by rarity (decision 121).
    for verses in b.chapters.values():
        for v in verses:
            for m in v["mentions"] + v["filed_under"]:
                m["weight"] = round(rarity(b, m["id"]), 4)

    shared = Counter()  # (ID, ID) -> number of shared Verses in range
    provenance = defaultdict(set)  # (ID, ID) -> (source, licence) of their links to those Verses
    for verses in b.chapters.values():
        for v in verses:  # Mentions, and Filed Under for a Theme
            links = {m["id"]: (m["source"], m["licence"]) for m in v["mentions"] + v["filed_under"]}
            for pair in combinations(sorted(links), 2):
                shared[pair] += 1
                provenance[pair] |= {links[i] for i in pair}

    neighbours = {e["id"]: {n["id"]: n for n in e["neighbours"]} for e in b.entities.values()}
    for (x, y), n in sorted(shared.items()):
        a, c = b.verse_sets[x], b.verse_sets[y]
        cosine = round(len(a & c) / math.sqrt(len(a) * len(c)), 4)
        item = {
            "edge": "CO_MENTION",
            "direction": "both",
            "shared_verses": n,
            "cosine": cosine,  # Ring 2 ranks every type on this one scale (decision 111)
            **joined(provenance[x, y]),
        }
        for here, there in ((x, y), (y, x)):
            # Cosine favours a tiny heading (VENERATION, 2 Verses) over a broad one (FAITH), so a
            # Theme neighbour is weighted by how many Verses it shares, damped by how broad the
            # heading is. Ring 1 never compares types, so the scales may differ (decision 93).
            theme = there.startswith("theme:")
            weight = round(len(a & c) * rarity(b, there), 4) if theme else cosine
            found = neighbours[here].get(there)
            if not found:
                found = {"id": there, "type": b.entities[there]["type"], "edges": []}
                neighbours[here][there] = found
                b.entities[here]["neighbours"].append(found)
            found["weight"] = weight
            found["edges"] = sorted(found["edges"] + [item], key=lambda i: i["edge"])

    # Rank by weight alone, then ID. An explicit edge is a label, not a priority (decision 94).
    for e in b.entities.values():
        e["neighbours"].sort(key=lambda n: (-n["weight"], n["id"]))
        types = Counter(n["type"] for n in e["neighbours"]) + Counter(verse=len(e["verses"]))
        e["overflow"] = {t: max(0, count - RING1_PER_TYPE) for t, count in types.items()}

    # Ring 2: the top Neighbours of each Ring 1 node, as ID and weight. An Entity's come from
    # its Entity Neighbours, a Verse's from its cross-references, so that no list ranks weights
    # of two scales together (decision 93). `b.top` also feeds the chapter Ring 2 (decision 96).
    # Ring 2 mixes types, so it ranks on the cosine, never on a Theme's rarity weight.
    def on_cosine(e):
        scored = [{"id": n["id"], "weight": cosine_of(n)} for n in e["neighbours"]]
        return sorted(scored, key=lambda n: (-n["weight"], n["id"]))

    b.top = {e["id"]: ring2_entries(on_cosine(e)) for e in b.entities.values()}
    verses = {v["key"]: v for vs in b.chapters.values() for v in vs}
    for e in b.entities.values():
        ring1 = [v["key"] for v in e["verses"][:RING1_PER_TYPE]]
        for t in {n["type"] for n in e["neighbours"]}:
            ring1 += [n["id"] for n in e["neighbours"] if n["type"] == t][:RING1_PER_TYPE]
        e["ring2"] = {
            node: ring2_entries(verses[node]["cross_references"]) if node in verses else b.top[node]
            for node in ring1
        }
