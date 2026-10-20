"""The search index (PRD 8.2): names, aliases, types, and IDs of every Entity, and the books.
It is also the label lookup for Ring 2 IDs. Called by `export`, so it sees every Entity that
any step added.

`books` lists all 66 books, so any Verse Key can be labelled, even one outside the book range
(stories 44 and 69). `number` is the BB of the Verse Key; `chapters` is empty outside the range.

An Entity whose name another Entity of the same type shares gets a `hint` (decision 122): the
reference of its first whole-Bible Verse that none of them shares, else the number in its ID."""

import re
from collections import defaultdict


def index(b):
    entities = [
        {
            "id": e["id"],
            "type": e["type"],
            "name": e.get("name") or e["title"],  # Events have a title (decision 62)
            "aliases": e.get("aliases", []),
        }
        for e in sorted(b.entities.values(), key=lambda e: e["id"])
    ]
    osis = {f"{v['order']:02}": book for book, v in b.books.items()}
    namesakes = defaultdict(list)
    for e in entities:
        namesakes[e["type"], e["name"]].append(e["id"])
    for e in entities:
        others = [i for i in namesakes[e["type"], e["name"]] if i != e["id"]]
        if not others:
            continue
        shared = set().union(*(b.verse_sets.get(i, ()) for i in others))
        own = sorted(b.verse_sets.get(e["id"], set()) - shared)  # Verse Keys, BBCCCVVV
        if own:
            k = own[0]
            e["hint"] = f"{osis[k[:2]]} {int(k[2:5])}:{int(k[5:])}"
        else:
            e["hint"] = re.search(r"\d+$", e["id"])[0]
    return {
        "entities": entities,
        "books": [
            {
                "number": f"{b.books[book]['order']:02}",
                "osis": book,
                "name": b.books[book]["name"],
                "chapters": sorted(ch for bk, ch in b.chapters if bk == book),
            }
            for book in sorted(b.books, key=lambda o: b.books[o]["order"])
        ],
    }
