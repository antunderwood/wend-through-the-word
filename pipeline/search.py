"""The search index (PRD 8.2): names, aliases, types, and IDs of every Entity, and the books.
It is also the label lookup for Ring 2 IDs. Called by `export`, so it sees every Entity that
any step added.

`books` lists all 66 books, so any Verse Key can be labelled, even one outside the book range
(stories 44 and 69). `number` is the BB of the Verse Key; `chapters` is empty outside the range.

An Entity whose name another Entity of the same type shares gets a `hint` (decision 122): the
reference of its first whole-Bible Verse that none of them shares, else the number in its ID.
Such a Person also gets a `relation` (decision 125): the first of its family relations, such as
"son of Seir", that none of them has."""

import re
from collections import defaultdict

# Family relations in hint order: the edge, its direction read from the Person, and the word for
# a Male, a Female, or another Person.
RELATIONS = [
    ("PARENT_OF", "in", ("son", "daughter", "child")),
    ("PARENT_OF", "out", ("father", "mother", "parent")),
    ("SPOUSE_OF", "both", ("husband", "wife", "spouse")),
    ("SIBLING_OF", "both", ("brother", "sister", "sibling")),
]


def relations(b, entity_id):
    """A Person's family relations, such as "son of Seir", in hint order, then Neighbour order.
    A relative's name drops any trailing parenthesis ("Benjamin (patriarch)")."""
    e = b.entities[entity_id]
    word = {"Male": 0, "Female": 1}.get(e.get("gender"), 2)
    return [
        f"{words[word]} of {re.sub(r' \(.*\)$', '', b.entities[n['id']]['name'])}"
        for edge, direction, words in RELATIONS
        for n in e["neighbours"]
        if any(x["edge"] == edge and x["direction"] == direction for x in n["edges"])
    ]


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
        if e["type"] == "person":
            theirs = {r for i in others for r in relations(b, i)}
            mine = [r for r in relations(b, e["id"]) if r not in theirs]
            if mine:
                e["relation"] = mine[0]
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
