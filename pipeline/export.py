"""Write the static export (PRD 8.2) and the reports. The last step of the build.

Every file must be below the size limit. A chapter file or Ring 2 sidecar over it loses its
lowest weight cross-references (decision 73). A file still over it is listed in
`split_or_trimmed.tsv`, and the build fails after writing the reports, so the limit never fails
silently (story 74)."""

import shutil
import sys

from pipeline import credits, ranking, search
from pipeline.common import to_json, write_json, write_tsv

NOT_TRIMMED = "not trimmed: over the limit, and only cross-references are trimmed"


def write(b):
    data, reports = b.out / "data", b.out / "reports"
    for d in (data, reports):
        shutil.rmtree(d, ignore_errors=True)
    version = data / b.cfg["data_version"]
    b.new_report("split_or_trimmed", "path", "action", "dropped", "lowest_weight_kept")

    for (book, ch), verses in b.chapters.items():
        path = version / "chapter" / book / f"{ch}.json"
        chapter = {"book": book, "chapter": ch, "verses": verses}
        fit(b, path, chapter, [v["cross_references"] for v in verses])
        write_json(path, chapter)
        ring1 = {n["id"] for v in verses for n in v["cross_references"]}
        ring2 = {key: list(b.ring2[key]) for key in ring1}
        sources = {("OpenBible.info", b.licence("crossrefs"))} if ring1 else set()
        # Every Entity a Verse mentions, and every Theme it is filed under, is in its Ring 1 too
        # (decision 96).
        for entity_id in {m["id"] for v in verses for m in v["mentions"] + v["filed_under"]}:
            ring2[entity_id] = b.top[entity_id]
            sources |= {
                (x["source"], x["licence"])
                for n in b.entities[entity_id]["neighbours"][: len(b.top[entity_id])]
                for x in n["edges"]
            }
        path = version / "chapter" / book / f"{ch}.ring2.json"
        sidecar = {"book": book, "chapter": ch, **ranking.joined(sources), "ring2": ring2}
        # Trim only cross-references: Votes and cosine scores are not compared (decision 93).
        fit(b, path, sidecar, [ring2[key] for key in ring1])
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
            "sources": {n: b.licence(n) for n in sorted(b.used - credits.CHECK_ONLY)},
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
    over = [path for path, size in files if size >= b.size_limit]
    for path, size in files:
        b.report("files", path=path, bytes=size, over_limit="yes" if path in over else "")
    reported = {r["path"] for r in b.reports["split_or_trimmed"][1]}
    for path in sorted(set(over) - reported):
        b.report(
            "split_or_trimmed", path=path, action=NOT_TRIMMED, dropped=0, lowest_weight_kept=""
        )
    b.new_report("file_count", "files", "over_limit")  # story 76: the 20,000 file limit
    b.report("file_count", files=len(files), over_limit=len(over))

    reports.mkdir(parents=True)
    for name, (header, rows) in b.reports.items():
        rows = sorted(rows, key=lambda r: [str(r[h]) for h in header])
        write_tsv(reports / f"{name}.tsv", header, rows)
    print(f"{len(files)} files, {len(over)} over {b.size_limit} bytes")
    if over:
        sys.exit(f"{len(over)} files are over the size limit: see reports/split_or_trimmed.tsv")


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
    if not drop(len(ranked)):  # keep them all; the build fails at the end
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
