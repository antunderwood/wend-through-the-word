"""Verses from the BSB text, keyed by Theographic's verseID. Sets `b.books`, `b.chapters`,
`b.verse_recs` (every Theographic verse record ID -> its Verse, or None outside the book range),
and `b.verse_keys` (every Theographic osisRef -> its Verse Key, in the book range or not)."""

import json
import re
import sys
from collections import defaultdict

# Verse exceptions (PRD 7.1). This is the one place they live.
BSB_BOOK_NAMES = {"Psalm": "Psalms"}  # BSB book name -> Theographic bookName
REMAP = {"3John.1.15": "3John.1.14"}  # OpenBible ref -> Theographic osisRef; the only data change
NOTES = {  # noted, not changed
    "Rev.12.17": "ends at a different point in the BSB and the KJV",
    "Ps": "the BSB puts Psalm titles in verse 1",
}


def load(b):
    rows = [r["fields"] for r in json.loads(b.source("theo-books").read_text())]
    b.books = {r["osisName"]: {"name": r["bookName"], "order": r["bookOrder"]} for r in rows}
    osis_of = {r["bookName"]: r["osisName"] for r in rows}
    wanted = set(b.cfg["books"])
    if unknown := wanted - set(b.books):
        sys.exit(f"unknown books in config: {sorted(unknown)}")
    b.book_range = sorted(wanted, key=lambda o: b.books[o]["order"])

    bsb = {}
    for line in b.source("bsb").read_text(encoding="utf-8-sig").splitlines():
        if m := re.match(r"(.+) (\d+):(\d+)\t(.*)", line):
            osis = osis_of.get(BSB_BOOK_NAMES.get(m[1], m[1]))
            if osis in wanted:
                bsb[f"{osis}.{m[2]}.{m[3]}"] = m[4].strip()

    b.new_report("verse_mismatches", "verse", "cause", "count")
    b.chapters = defaultdict(list)  # (book, chapter) -> verses
    b.verse_recs = {}
    b.verse_keys = {}
    seen = set()
    for r in json.loads(b.source("theo-verses").read_text()):
        f = r["fields"]
        book, ch, vs = f["osisRef"].split(".")
        b.verse_recs[r["id"]] = None
        b.verse_keys[f["osisRef"]] = f["verseID"]
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
            "licence": b.licence("bsb"),
        }
        if not verse["text_bsb"]:
            verse["no_bsb_text"] = True
            b.report("verse_mismatches", verse=f["osisRef"], cause="no BSB text (kept)", count=1)
        b.chapters[book, int(ch)].append(verse)
        b.verse_recs[r["id"]] = verse
    for verses in b.chapters.values():
        verses.sort(key=lambda v: v["key"])

    for osis in bsb.keys() - seen:
        b.report(
            "verse_mismatches",
            verse=osis,
            cause="BSB verse with no Theographic verse key (dropped)",
            count=1,
        )
    for ref, note in NOTES.items():
        if ref.split(".")[0] in wanted:
            b.report("verse_mismatches", verse=ref, cause=f"note: {note}", count=1)
