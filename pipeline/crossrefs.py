"""OpenBible cross-references as CROSS_REF edges, weighted by Votes.

Adds `cross_references` (Ring 1) to each Verse in the book range: every edge with an end at that
Verse, so an edge is kept when its other end is outside the range (spec, story 44). Sets
`b.ring2`: for each Verse in some Ring 1, its top 10 cross-referenced Verses as ID and weight.
"""

import zipfile
from collections import Counter, defaultdict

from pipeline.common import to_json
from pipeline.verses import REMAP

RING2_TOP = 10  # the browser filters these and shows 3 (PRD 10.4)


def load(b):
    path = b.source("crossrefs")
    _, *rows = zipfile.ZipFile(path).read("cross_references.txt").decode().splitlines()
    by_key = {v["key"]: v for verses in b.chapters.values() for v in verses}
    for v in by_key.values():
        v["cross_references"] = []
    openbible = {"source": "OpenBible.info", "licence": b.licence("crossrefs")}
    missing = Counter()  # refs with no Verse Key
    votes_between = defaultdict(dict)  # key -> other key -> highest Votes, both directions
    for row in rows:
        a, to, votes = row.split("\t")
        start, _, end = to.partition("-")
        refs = [a, start, end] if end else [a, start]
        keys = [b.verse_keys.get(REMAP.get(r, r)) for r in refs]
        if None in keys:
            missing.update(r for r, k in zip(refs, keys) if k is None)
            continue
        edge = {"edge": "CROSS_REF", "weight": int(votes), **openbible}
        if end:  # a range is one edge to its first verse (decision 52)
            edge["to_end_key"] = keys[2]
        for here, there, direction in ((keys[0], keys[1], "out"), (keys[1], keys[0], "in")):
            if here in by_key:
                by_key[here]["cross_references"].append(
                    {"key": there, "direction": direction, **edge}
                )
            seen = votes_between[here].get(there, edge["weight"])
            votes_between[here][there] = max(seen, edge["weight"])
    for v in by_key.values():
        v["cross_references"].sort(key=lambda r: (-r["weight"], r["key"], r["direction"]))
    for ref, count in missing.items():
        cause = "OpenBible cross-reference with no Verse Key (dropped)"
        b.report("verse_mismatches", verse=ref, cause=cause, count=count)

    ring1 = {r["key"] for v in by_key.values() for r in v["cross_references"]}
    b.ring2 = {}
    for key in ring1:
        top = sorted(votes_between[key].items(), key=lambda kv: (-kv[1], kv[0]))[:RING2_TOP]
        b.ring2[key] = [{"id": other, "weight": votes} for other, votes in top]
    b.new_report("split_or_trimmed", "path", "action", "dropped", "lowest_votes_kept")


def fit(b, path, data, lists):
    """Drop the lowest Vote entries of `lists` (lists inside `data`) until `data` is below the
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
        b.report("split_or_trimmed", path=path, action=action, dropped=0, lowest_votes_kept="")
        return
    lo, hi = 0, len(ranked)
    while lo < hi:
        mid = (lo + hi) // 2
        lo, hi = (lo, mid) if drop(mid) else (mid + 1, hi)
    drop(lo)
    kept = ranked[lo]["weight"] if lo < len(ranked) else ""
    b.report("split_or_trimmed", path=path, action="trimmed", dropped=lo, lowest_votes_kept=kept)
