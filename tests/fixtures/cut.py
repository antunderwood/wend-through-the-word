"""Cut the fixture sources from a full download. Run from the repo root:

    python -I tests/fixtures/cut.py SOURCES_DIR

Keeps only the chapters below. Strips KJV text from Theographic verses (decision 42).
Adds one synthetic BSB line, 3 John 1:15, to test a BSB verse with no Theographic key.
"""

import json
import re
import sys
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
dump("verses.json", verses)

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
