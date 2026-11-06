"""Versification (decision 216, #126). The Verse Key is KJV versification. Each source declares the
versification its references follow (`VERSIFICATION` in `pipeline/download.py`), and every
reference is moved into KJV numbering with STEPBible's TVTMS (CC BY 4.0) before it is joined.

Schemes:
- `kjv`: KJV numbering. Only a Psalm title written as verse 0 (TIPNR's "Ps.3.0") moves.
- `esv`, `nrsv`, `niv`, `na`: the English and Greek New Testament numberings in TVTMS's table of
  differences from the KJV. Only rows TVTMS marks with an asterisk move.
- `hebrew`: the Masoretic numbering (Macula, TAHOT, ACAI), from the "Hebrew" column of each
  section of TVTMS's condensed data: Psalm titles, Joel 3 and 4, Malachi 4, and the rest.

A Psalm title has no Verse Key, so it moves to verse 1, where the BSB prints it (`verses.NOTES`).
A reference TVTMS cannot place on one whole KJV verse (a subverse or a moved passage) is left as
it is. Verses that split or join map many to one: ESV 3 John 1:15 is KJV 3 John 1:14.

Usage:
    python -m pipeline.versification TVTMS_FILE SCHEME REF...   print each REF in KJV numbering
"""

import argparse
import re
from pathlib import Path

from pipeline.themes import OSIS_NAMES
from pipeline.tipnr import STEP_BOOKS

BOOKS = dict(zip(STEP_BOOKS.split(), OSIS_NAMES.split()))  # TVTMS (SIL) code -> OSIS name
TABLE = {"SBLG": "na", "NRSV": "nrsv", "ESV": "esv", "NIV": "niv", "KJV": "kjv"}
SCHEMES = ("kjv", "esv", "nrsv", "niv", "na", "hebrew")
# "Psa.3:Title", "*Php.1:16", "Jol.2:28-32", "Rev.13:1a" (a subverse is its verse); not
# "Absent [=Psa.3:1]", "Rev.12:18-13:1", "Gen.6:1.2" or "Jos.9:2*a-b".
REF = re.compile(r"\*?(\w+)\.(\d+):(Title|\d+)[a-z]?(?:-(\d+)[a-z]?)?")


def verses(cell):
    """The OSIS refs of one TVTMS cell, or None when it is not whole verses of one chapter.
    A title is verse 1."""
    m = REF.fullmatch(cell.strip())
    if not m or m[1] not in BOOKS:
        return None
    book, chapter = BOOKS[m[1]], m[2]
    first = 1 if m[3] == "Title" else int(m[3])
    last = int(m[4]) if m[4] else first
    return [f"{book}.{chapter}.{v}" for v in range(first, last + 1)]


def pairs(source, kjv):
    """Source ref -> KJV ref for one row: verse by verse, or many verses to one."""
    if source is None or kjv is None:
        return []
    if len(source) == len(kjv):
        return list(zip(source, kjv))
    if len(kjv) == 1:
        return [(s, kjv[0]) for s in source]
    if len(source) == 1:
        return [(source[0], kjv[0])]
    return []


def english(lines):
    """Scheme -> {ref: KJV ref} from the table of differences in TVTMS's preamble."""
    out = {TABLE[k]: {} for k in TABLE}
    columns = None
    for line in lines:
        cells = [c.strip() for c in line.split("\t")]
        if "KJV" in cells and "ESV" in cells:
            columns = [next((s for k, s in TABLE.items() if k in c), None) for c in cells]
            continue
        if columns is None:
            continue
        if line.startswith("So, for"):
            break
        kjv = verses(cells[columns.index("kjv")])
        for scheme, cell in zip(columns, cells):
            if scheme and scheme != "kjv" and cell.startswith("*"):
                out[scheme].update(pairs(verses(cell), kjv))
    return out


def hebrew(lines):
    """{ref: KJV ref} from the "Hebrew" column of each condensed section."""
    out = {}
    names = None
    for line in lines:
        cells = [c.strip() for c in line.split("\t")]
        if line.startswith("$"):
            names = cells if len([c for c in cells if c]) > 1 else None
            continue
        if cells[0] == "BIBLES":
            names = cells
            continue
        if not names or "Hebrew" not in names or "English KJV" not in names:
            continue
        if len(cells) <= names.index("Hebrew") or line.startswith(("#", "TEST")):
            continue
        kjv = verses(cells[names.index("English KJV")])
        for ref, to in pairs(verses(cells[names.index("Hebrew")]), kjv):
            out.setdefault(ref, to)  # a ref in two sections keeps its first
    return out


def read(path):
    """Scheme -> {ref: KJV ref}, only for refs that move. `kjv` is filled in by `to_kjv`."""
    lines = Path(path).read_text(encoding="utf-8-sig").splitlines()
    start = next(i for i, x in enumerate(lines) if x.startswith("#DataStart(Condensed)"))
    end = next(i for i, x in enumerate(lines) if x.startswith("#DataEnd(Condensed)"))
    maps = english(lines[:start])
    maps["hebrew"] = hebrew(lines[start + 1 : end])
    return {s: {r: k for r, k in m.items() if r != k} for s, m in maps.items()}


TITLE = re.compile(r"(Ps)\.(\d+)\.0")


def to_kjv(maps, scheme, ref):
    """`ref` (OSIS, in `scheme`) in KJV numbering. A Psalm title as verse 0 is verse 1."""
    if m := TITLE.fullmatch(ref):
        return f"{m[1]}.{m[2]}.1"
    return maps[scheme].get(ref, ref)


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m pipeline.versification")
    p.add_argument("tvtms", type=Path)
    p.add_argument("scheme", choices=SCHEMES)
    p.add_argument("refs", nargs="+")
    a = p.parse_args(argv)
    maps = read(a.tvtms)
    for ref in a.refs:
        print(ref, to_kjv(maps, a.scheme, ref), sep="\t")


if __name__ == "__main__":
    main()
