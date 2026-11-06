"""Verses from the BSB text, keyed by Theographic's verseID. Sets `b.books`, `b.chapters`,
`b.verse_recs` (every Theographic verse record ID -> its Verse, or None outside the book range),
`b.verse_keys` (every Theographic osisRef -> its Verse Key, in the book range or not), and
`b.rec_keys` (every Theographic verse record ID -> its Verse Key, in the book range or not),
and `b.to_kjv(source, ref)`, which moves a source's reference into KJV numbering (decision 216)
and lists each move in `versification_moves`."""

import json
import re
import sys
from collections import defaultdict

from pipeline import versification
from pipeline.download import VERSIFICATION

# Verse exceptions (PRD 7.1). This is the one place they live.
BSB_BOOK_NAMES = {"Psalm": "Psalms"}  # BSB book name -> Theographic bookName
NOTES = {  # noted, not changed
    "Rev.12.17": "ends at a different point in the BSB and the KJV",
    "Ps": "the BSB puts Psalm titles in verse 1",
}


def kjv_mover(b):
    """`to_kjv(source, ref)`: the ref in KJV numbering, by the source's declared versification.
    Each move is a row of `versification_moves`, counted."""
    maps = versification.read(b.source("tvtms"))
    b.new_report("versification_moves", "source", "ref", "kjv", "count")
    rows = {}

    def to_kjv(source, ref):
        to = versification.to_kjv(maps, VERSIFICATION[source], ref)
        if to != ref:
            if (source, ref) not in rows:
                rows[source, ref] = {"source": source, "ref": ref, "kjv": to, "count": 0}
                b.reports["versification_moves"][1].append(rows[source, ref])
            rows[source, ref]["count"] += 1
        return to

    return to_kjv


def load(b):
    b.to_kjv = kjv_mover(b)
    rows = [r["fields"] for r in json.loads(b.source("theo-books").read_text())]
    b.books = {r["osisName"]: {"name": r["bookName"], "order": r["bookOrder"]} for r in rows}
    osis_of = {r["bookName"]: r["osisName"] for r in rows}
    wanted = set(b.cfg["books"])
    if unknown := wanted - set(b.books):
        sys.exit(f"unknown books in config: {sorted(unknown)}")
    b.book_range = sorted(wanted, key=lambda o: b.books[o]["order"])

    whole = {}  # every book: a Person's or Place's name is checked against all its Verses
    for line in b.source("bsb").read_text(encoding="utf-8-sig").splitlines():
        if m := re.match(r"(.+) (\d+):(\d+)\t(.*)", line):
            osis = osis_of.get(BSB_BOOK_NAMES.get(m[1], m[1]))
            ref = b.to_kjv("bsb", f"{osis}.{m[2]}.{m[3]}")
            # Two verses of a source in one KJV verse are joined, in the source's order.
            whole[ref] = f"{whole[ref]} {m[4].strip()}" if ref in whole else m[4].strip()
    bsb = {ref: text for ref, text in whole.items() if ref.split(".")[0] in wanted}

    b.new_report("verse_mismatches", "verse", "cause", "count")
    b.chapters = defaultdict(list)  # (book, chapter) -> verses
    b.verse_recs = {}
    b.verse_keys = {}
    b.rec_keys = {}
    seen = set()
    for r in json.loads(b.source("theo-verses").read_text()):
        f = r["fields"]
        book, ch, vs = f["osisRef"].split(".")
        b.verse_recs[r["id"]] = None
        b.verse_keys[f["osisRef"]] = b.rec_keys[r["id"]] = f["verseID"]
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
    b.bsb = {b.verse_keys[ref]: text for ref, text in whole.items() if ref in b.verse_keys}
    # Words the BSB writes in lower case, not after a hyphen: "kiriathaim" in "Shaveh-kiriathaim"
    # is a name.
    b.bsb_common = {w for t in whole.values() for w in re.findall(r"(?<![\w-])[a-z]+\b", t)}

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
