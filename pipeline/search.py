"""The search index (PRD 8.2): names, aliases, types, and IDs of every Entity, and the books.
It is also the label lookup for Ring 2 IDs. Called by `export`, so it sees every Entity that
any step added."""


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
                "osis": book,
                "name": b.books[book]["name"],
                "chapters": sorted(ch for bk, ch in b.chapters if bk == book),
            }
            for book in b.book_range
        ],
    }
