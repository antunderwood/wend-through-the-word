"""OpenBible cross-references as CROSS_REF edges, weighted by Votes.

Adds `cross_references` (Ring 1) to each Verse in the book range: one Neighbour for each Verse
that a cross-reference links it to, in either direction, so a link is kept when its other end is
outside the range (spec, story 44). A Neighbour has the shape of an Entity Neighbour (#6), with
the higher Votes as its weight (decision 74). Sets `b.ring2`: for each Verse in some Ring 1, its
top 10 cross-referenced Verses as ID and weight.
"""

import zipfile
from collections import Counter, defaultdict

from pipeline.common import report_mismatches, ring2_entries
from pipeline.verses import REMAP


def load(b):
    path = b.source("crossrefs")
    _, *rows = zipfile.ZipFile(path).read("cross_references.txt").decode().splitlines()
    openbible = {"source": "OpenBible.info", "licence": b.licence("crossrefs")}
    missing = Counter()  # refs with no Verse Key
    # key -> other key -> (Votes, direction, range end key) of each edge, both directions
    edges = defaultdict(lambda: defaultdict(list))
    for row in rows:
        a, to, votes = row.split("\t")
        start, _, end = to.partition("-")
        refs = [a, start, end] if end else [a, start]
        keys = [b.verse_keys.get(REMAP.get(r, r)) for r in refs]
        if None in keys:
            missing.update(r for r, k in zip(refs, keys) if k is None)
            continue
        end_key = keys[2] if end else None  # a range is one edge to its first verse (dec. 52)
        for here, there, direction in ((keys[0], keys[1], "out"), (keys[1], keys[0], "in")):
            edges[here][there].append((int(votes), direction, end_key))
    report_mismatches(b, missing, "OpenBible cross-reference with no Verse Key (dropped)")

    def edge(votes, direction, end_key):
        e = {"edge": "CROSS_REF", "direction": direction, "votes": votes, **openbible}
        return e | {"to_end_key": end_key} if end_key else e

    def neighbours(key):
        found = [
            {
                "id": other,
                "type": "verse",
                "weight": max(votes for votes, _, _ in pair),
                "edges": [edge(*e) for e in sorted(pair, key=lambda e: (-e[0], e[1], e[2] or ""))],
            }
            for other, pair in edges[key].items()
        ]
        return sorted(found, key=lambda n: (-n["weight"], n["id"]))

    ring1 = set()
    for verses in b.chapters.values():
        for v in verses:
            v["cross_references"] = neighbours(v["key"])
            ring1.update(n["id"] for n in v["cross_references"])
    b.ring2 = {key: ring2_entries(neighbours(key)) for key in ring1}
