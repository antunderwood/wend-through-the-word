"""OpenBible cross-references as CROSS_REF edges, weighted by Votes.

Adds `cross_references` (Ring 1) to each Verse in the book range: one Neighbour for each Verse
that a cross-reference links it to, in either direction, so a link is kept when its other end is
outside the range (spec, story 44). A Neighbour has the shape of an Entity Neighbour (#6), with
the higher Votes as its weight (decision 71). Sets `b.ring2`: for each Verse in some Ring 1, its
top 10 cross-referenced Verses as ID and weight.
"""

import zipfile
from collections import Counter, defaultdict

from pipeline.common import to_json
from pipeline.verses import REMAP

RING2_TOP = 10  # the browser filters these and shows 3 (PRD 10.4)


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
    for ref, count in missing.items():
        cause = "OpenBible cross-reference with no Verse Key (dropped)"
        b.report("verse_mismatches", verse=ref, cause=cause, count=count)

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
    b.ring2 = {
        key: [{"id": n["id"], "weight": n["weight"]} for n in neighbours(key)[:RING2_TOP]]
        for key in ring1
    }
    b.new_report("split_or_trimmed", "path", "action", "dropped", "lowest_weight_kept")


def fit(b, path, data, lists):
    """Drop the lowest weight entries of `lists` (lists inside `data`) until `data` is below the
    size limit (PRD 8.2), and report it. Searches for the fewest entries to drop."""
    if len(to_json(data).encode()) < b.size_limit:
        return
    original = [list(entries) for entries in lists]
    ranked = sorted((e for entries in original for e in entries), key=lambda e: e["weight"])

    def drop(n):
        gone = {id(e) for e in ranked[:n]}
        for entries, before in zip(lists, original):
            entries[:] = [e for e in before if id(e) not in gone]
        return len(to_json(data).encode()) < b.size_limit

    path = path.relative_to(b.out).as_posix()
    if not drop(len(ranked)):  # keep them all; the files report flags the file
        drop(0)
        action = "not trimmed: over the limit even with no cross-references"
        b.report("split_or_trimmed", path=path, action=action, dropped=0, lowest_weight_kept="")
        return
    lo, hi = 0, len(ranked)
    while lo < hi:
        mid = (lo + hi) // 2
        lo, hi = (lo, mid) if drop(mid) else (mid + 1, hi)
    drop(lo)
    kept = ranked[lo]["weight"] if lo < len(ranked) else ""
    b.report("split_or_trimmed", path=path, action="trimmed", dropped=lo, lowest_weight_kept=kept)
