"""Cut the fixture sources from a full download. Run from the repo root:

    python -I tests/fixtures/cut.py SOURCES_DIR

Keeps only the chapters below. Strips KJV text from Theographic verses (decision 42).
Adds one synthetic BSB line, 3 John 1:15, to test a BSB verse with no Theographic key.
Keeps the OpenBible cross-references that touch a kept verse, with two synthetic rows.
"""

import json
import re
import sys
import zipfile
from pathlib import Path

CHAPTERS = {"Gen": {11, 16, 25, 26, 36}, "Matt": {17}, "3John": {1}}
MATT_VERSES = {20, 21, 22}  # Matt 17:21 has no BSB text
BSB_NAMES = {"Genesis": "Gen", "Matthew": "Matt", "3 John": "3John"}
KJV_FIELDS = {"verseText", "mdText", "richText"}

src, dest = Path(sys.argv[1]), Path(__file__).parent / "sources"


def keep(book, ch, vs):
    return ch in CHAPTERS.get(book, ()) and (book != "Matt" or vs in MATT_VERSES)


def dump(name, rows):
    (dest / name).write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")


books = [
    r for r in json.loads((src / "books.json").read_text()) if r["fields"]["osisName"] in CHAPTERS
]
for r in books:
    r["fields"] = {k: v for k, v in r["fields"].items() if not isinstance(v, list)}
dump("books.json", books)

verses = []
for r in json.loads((src / "verses.json").read_text()):
    book, ch, vs = r["fields"]["osisRef"].split(".")
    if keep(book, int(ch), int(vs)):
        r["fields"] = {k: v for k, v in r["fields"].items() if k not in KJV_FIELDS}
        verses.append(r)

# Cross-references with an end in a kept verse. Every other end must be outside the fixture
# books, so it adds no Verse to the build; the Theographic records of those ends are kept with
# only their osisRef and verseID.
zipped = zipfile.ZipFile(src / "cross-references.zip")
header, *rows = zipped.read("cross_references.txt").decode().splitlines()
kept_refs = {r["fields"]["osisRef"] for r in verses} | {"3John.1.15"}
crossrefs, outside = [header], set()
for row in rows:
    a, b, _ = row.split("\t")
    refs = {a, *b.split("-")}
    if refs & kept_refs and all(r in kept_refs or r.split(".")[0] not in CHAPTERS for r in refs):
        crossrefs.append(row)
        outside |= refs - kept_refs
crossrefs += [
    "Matt.17.20\t3John.1.15\t3",  # synthetic: a cross-reference to 3John.1.15
    "Gen.11.1\tGen.11.33\t1",  # synthetic: Genesis 11 has 32 verses, so no Verse Key
]
info = zipfile.ZipInfo("cross_references.txt", date_time=(1980, 1, 1, 0, 0, 0))
with zipfile.ZipFile(dest / "cross-references.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr(info, "\n".join(crossrefs) + "\n", zipfile.ZIP_DEFLATED)
ends = [
    {"id": r["id"], "fields": {k: r["fields"][k] for k in ("osisRef", "verseID")}}
    for r in json.loads((src / "verses.json").read_text())
    if r["fields"]["osisRef"] in outside
]
dump("verses.json", verses + ends)

lines = []
for line in (src / "bsb.txt").read_text(encoding="utf-8-sig").splitlines():
    m = re.match(r"(.+) (\d+):(\d+)\t", line)
    if not m:
        lines.append(line)  # header
    elif m[1] in BSB_NAMES and keep(BSB_NAMES[m[1]], int(m[2]), int(m[3])):
        lines.append(line)
lines.append("3 John 1:15\tSynthetic test line: a BSB verse with no Theographic key.")
(dest / "bsb.txt").write_text("\n".join(lines) + "\n")

# Entities that a kept verse mentions, with their `verses` cut to the kept verses.
kept = {r["fields"]["osisRef"]: r["id"] for r in verses}
SYNTHETIC = {  # (file, ID field, ID) -> change, each one listed in README.md
    ("people.json", "personLookup", "abraham_58"): lambda f: f["verses"].append(
        "recFixtureNoVerse"  # a mention whose verse record does not exist
    ),
    ("people.json", "personLookup", "demetrius_1007"): lambda f: f.pop("dictText"),
    ("peopleGroups.json", "groupName", "Tribe of Judah"): lambda f: f.update(
        verses=[kept["Gen.36.1"]]  # no group has a real verse in the kept chapters
    ),
}
for name in ("people.json", "places.json", "events.json", "peopleGroups.json"):
    rows = []
    for r in json.loads((src / name).read_text()):
        f = r["fields"]
        f["verses"] = [v for v in f.get("verses") or [] if v in kept.values()]
        for (file, field, value), change in SYNTHETIC.items():
            if file == name and f.get(field) == value:
                change(f)
        if f["verses"]:
            rows.append(r)
    dump(name, rows)
