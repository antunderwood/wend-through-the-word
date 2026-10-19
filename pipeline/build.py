"""Build the static export and the reports from local files only. Never touches the network.

Usage:
    python -m pipeline.build CONFIG.toml

Config keys: books (OSIS names), sources (folder), out (folder), build_date, data_version.
"""

import json
import re
import shutil
import sys
import tomllib
from collections import defaultdict
from pathlib import Path

from pipeline.download import SOURCES, file_name

SIZE_LIMIT = 500 * 1000  # bytes, PRD 8.2

# Verse exceptions (PRD 7.1). This is the one place they live.
BSB_BOOK_NAMES = {"Psalm": "Psalms"}  # BSB book name -> Theographic bookName
NOTES = {  # noted, not changed
    "Rev.12.17": "ends at a different point in the BSB and the KJV",
    "Ps": "the BSB puts Psalm titles in verse 1",
}


def source_path(cfg, name):
    return Path(cfg["sources"]) / file_name(SOURCES[name][0])


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=1) + "\n")


def build(cfg):
    out = Path(cfg["out"])
    data, reports = out / "data", out / "reports"
    for d in (data, reports):
        shutil.rmtree(d, ignore_errors=True)
    version_dir = data / cfg["data_version"]

    book_rows = [r["fields"] for r in json.loads(source_path(cfg, "theo-books").read_text())]
    books = {b["bookName"]: b["osisName"] for b in book_rows}
    names = {b["osisName"]: b["bookName"] for b in book_rows}
    order = {b["osisName"]: b["bookOrder"] for b in book_rows}
    wanted = set(cfg["books"])
    if unknown := wanted - set(names):
        sys.exit(f"unknown books in config: {sorted(unknown)}")

    bsb = {}
    for line in source_path(cfg, "bsb").read_text(encoding="utf-8-sig").splitlines():
        if m := re.match(r"(.+) (\d+):(\d+)\t(.*)", line):
            osis = books.get(BSB_BOOK_NAMES.get(m[1], m[1]))
            if osis in wanted:
                bsb[f"{osis}.{m[2]}.{m[3]}"] = m[4].strip()

    mismatches = []
    chapters = defaultdict(list)
    seen = set()
    for r in json.loads(source_path(cfg, "theo-verses").read_text()):
        f = r["fields"]
        book, ch, vs = f["osisRef"].split(".")
        if book not in wanted:
            continue
        seen.add(f["osisRef"])
        verse = {
            "key": f["verseID"],
            "label": f["osisRef"],
            "book": book,
            "chapter": int(ch),
            "verse": int(vs),
            "text_bsb": bsb.get(f["osisRef"]) or None,
            "source": "BSB",
            "licence": SOURCES["bsb"][1],
        }
        if not verse["text_bsb"]:
            verse["no_bsb_text"] = True
            mismatches.append((f["osisRef"], "no BSB text (kept)"))
        chapters[book, int(ch)].append(verse)
    for osis in bsb.keys() - seen:
        mismatches.append((osis, "BSB verse with no Theographic verse key (dropped)"))
    for ref, note in NOTES.items():
        if ref.split(".")[0] in wanted:
            mismatches.append((ref, f"note: {note}"))

    for (book, ch), verses in chapters.items():
        verses.sort(key=lambda v: v["key"])
        write_json(
            version_dir / "chapter" / book / f"{ch}.json",
            {"book": book, "chapter": ch, "verses": verses},
        )

    used = ["bsb", "theo-books", "theo-verses"]
    write_json(
        data / "index.json",
        {
            "build_date": cfg["build_date"],
            "data_version": cfg["data_version"],
            "licence": "CC BY-SA 4.0",
            "sources": {n: SOURCES[n][1] for n in used},
            "books": [
                {
                    "osis": b,
                    "name": names[b],
                    "chapters": sum(1 for bk, _ in chapters if bk == b),
                    "verses": sum(len(v) for (bk, _), v in chapters.items() if bk == b),
                }
                for b in sorted(wanted, key=order.get)
            ],
            "counts": {
                "chapters": len(chapters),
                "verses": sum(len(v) for v in chapters.values()),
            },
        },
    )

    reports.mkdir(parents=True)
    write_tsv(reports / "verse_mismatches.tsv", ["verse", "cause"], sorted(mismatches))
    files = sorted((p.relative_to(out).as_posix(), p.stat().st_size) for p in data.rglob("*.json"))
    over = [(p, s) for p, s in files if s >= SIZE_LIMIT]
    write_tsv(
        reports / "files.tsv",
        ["path", "bytes", "over_limit"],
        [(p, s, "yes" if s >= SIZE_LIMIT else "") for p, s in files],
    )
    print(f"{len(files)} files, {len(over)} over {SIZE_LIMIT} bytes, {len(mismatches)} mismatches")


def write_tsv(path, header, rows):
    lines = ["\t".join(header)] + ["\t".join(str(c) for c in r) for r in rows]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    build(tomllib.loads(Path(sys.argv[1]).read_text()))
