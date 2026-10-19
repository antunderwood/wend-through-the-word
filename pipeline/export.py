"""Write the static export (PRD 8.2) and the reports. The last step of the build."""

import shutil

from pipeline import credits, search
from pipeline.common import SIZE_LIMIT, write_json, write_tsv


def write(b):
    data, reports = b.out / "data", b.out / "reports"
    for d in (data, reports):
        shutil.rmtree(d, ignore_errors=True)
    version = data / b.cfg["data_version"]

    for (book, ch), verses in b.chapters.items():
        write_json(
            version / "chapter" / book / f"{ch}.json",
            {"book": book, "chapter": ch, "verses": verses},
        )
    for entity in b.entities.values():
        kind, name = entity["id"].split(":", 1)
        write_json(version / "entity" / kind / f"{name}.json", entity)
    write_json(version / "search-index.json", search.index(b))
    write_json(version / "credits.json", credits.credits(b))

    write_json(
        data / "index.json",
        {
            "build_date": b.cfg["build_date"],
            "data_version": b.cfg["data_version"],
            "licence": "CC BY-SA 4.0",
            "sources": {n: b.licence(n) for n in sorted(b.used)},
            "books": [
                {
                    "osis": book,
                    "name": b.books[book]["name"],
                    "chapters": sum(1 for bk, _ in b.chapters if bk == book),
                    "verses": sum(len(v) for (bk, _), v in b.chapters.items() if bk == book),
                }
                for book in b.book_range
            ],
            "counts": {
                "chapters": len(b.chapters),
                "verses": sum(len(v) for v in b.chapters.values()),
            },
        },
    )

    b.new_report("files", "path", "bytes", "over_limit")
    files = sorted(
        (p.relative_to(b.out).as_posix(), p.stat().st_size) for p in data.rglob("*.json")
    )
    for path, size in files:
        b.report("files", path=path, bytes=size, over_limit="yes" if size >= SIZE_LIMIT else "")

    reports.mkdir(parents=True)
    for name, (header, rows) in b.reports.items():
        rows = sorted(rows, key=lambda r: [str(r[h]) for h in header])
        write_tsv(reports / f"{name}.tsv", header, rows)
    over = sum(1 for _, s in files if s >= SIZE_LIMIT)
    print(f"{len(files)} files, {over} over {SIZE_LIMIT} bytes")
