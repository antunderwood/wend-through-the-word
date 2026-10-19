"""Write the static export (PRD 8.2) and the reports. The last step of the build."""

import shutil

from pipeline import credits, crossrefs, ranking, search
from pipeline.common import write_json, write_tsv


def write(b):
    data, reports = b.out / "data", b.out / "reports"
    for d in (data, reports):
        shutil.rmtree(d, ignore_errors=True)
    version = data / b.cfg["data_version"]

    for (book, ch), verses in b.chapters.items():
        path = version / "chapter" / book / f"{ch}.json"
        chapter = {"book": book, "chapter": ch, "verses": verses}
        crossrefs.fit(b, path, chapter, [v["cross_references"] for v in verses])
        write_json(path, chapter)
        ring1 = {n["id"] for v in verses for n in v["cross_references"]}
        ring2 = {key: list(b.ring2[key]) for key in ring1}
        sources = {("OpenBible.info", b.licence("crossrefs"))} if ring1 else set()
        # Every Entity a Verse mentions is in its Ring 1 too (decision 96).
        for entity_id in {m["id"] for v in verses for m in v["mentions"]}:
            ring2[entity_id] = b.top[entity_id]
            sources |= {
                (x["source"], x["licence"])
                for n in b.entities[entity_id]["neighbours"][: len(b.top[entity_id])]
                for x in n["edges"]
            }
        path = version / "chapter" / book / f"{ch}.ring2.json"
        sidecar = {"book": book, "chapter": ch, **ranking.joined(sources), "ring2": ring2}
        # Trim only cross-references: Votes and cosine scores are not compared (decision 93).
        crossrefs.fit(b, path, sidecar, [ring2[key] for key in ring1])
        write_json(path, sidecar)
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
        b.report("files", path=path, bytes=size, over_limit="yes" if size >= b.size_limit else "")

    reports.mkdir(parents=True)
    for name, (header, rows) in b.reports.items():
        rows = sorted(rows, key=lambda r: [str(r[h]) for h in header])
        write_tsv(reports / f"{name}.tsv", header, rows)
    over = sum(1 for _, s in files if s >= b.size_limit)
    print(f"{len(files)} files, {over} over {b.size_limit} bytes")
