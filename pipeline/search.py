"""The search index (PRD 8.2): names, aliases, types, and IDs of every Entity, and the books.
It is also the label lookup for Ring 2 IDs. Called by `export`, so it sees every Entity that
any step added.

`books` lists all 66 books, so any Verse Key can be labelled, even one outside the book range
(stories 44 and 69). `number` is the BB of the Verse Key; `chapters` is empty outside the range."""


def index(b):
    return {
        "entities": [
            {
                "id": e["id"],
                "type": e["type"],
                "name": e.get("name") or e["title"],  # Events have a title (decision 62)
                "aliases": e.get("aliases", []),
            }
            for e in sorted(b.entities.values(), key=lambda e: e["id"])
        ],
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
