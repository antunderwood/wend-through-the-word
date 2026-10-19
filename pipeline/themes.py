"""Themes from Nave's Topical Bible. Adds each Theme to `b.entities` and its whole-Bible Verse
set to `b.verse_sets` (decision 95), and sets `filed_under` on each Verse in the book range.

A heading is a Theme when it files a Verse in the book range and is not the name or an alias of
a Theographic Person or Place, unless a reviewed row in the curated `themes_keep.csv` keeps it
(decision 99, amended). A heading with only "See" lines files no Verse (decision 61).
A reference to a whole chapter is skipped (decision 59).
"""

import csv
import re
import sys
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict

from pipeline.common import norm, report_mismatches

# Nave's book codes, in Bible order, and the OSIS names Theographic uses, in the same order.
CODES = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC So ISA "
    "JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO "
    "2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN Jude REV"
)
OSIS_NAMES = (
    "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov "
    "Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt "
    "Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas "
    "1Pet 2Pet 1John 2John 3John Jude Rev"
)
OSIS = dict(zip(CODES.split(), OSIS_NAMES.split())) | {"1JHN": "1John"}  # 1JHN: once in Nave's
# "GEN 4:1-15,25; 5:3-6:2; with 22:6-19; 46" (a chapter with no verse is the whole chapter). A
# segment never runs into a word, so "; 1CO" is not chapter 1 of the book before.
SEG = r"\d+(?::\d+(?:-\d+(?::\d+)?)?(?:,\d+(?:-\d+)?)*)?(?!\w)"
BOOKS = "|".join(sorted(OSIS, key=len, reverse=True))
REF = re.compile(rf"\b({BOOKS}) ({SEG}(?:; (?:with )?{SEG})*)")


def theographic_names(b):
    """Normalised name -> IDs of the People and Places with that name, and the same for aliases.
    All of Theographic, so a heading's fate does not depend on the book range."""
    names, aliases = defaultdict(set), defaultdict(set)
    for kind, _, f, entity_id in b.records.values():
        if kind not in ("person", "place"):
            continue
        title = re.sub(r"\s*\(.*\)$", "", f["displayTitle"])  # "Jacob (Israel)" is Jacob
        if kind == "person":
            own, other = [f["name"], title], f.get("alsoCalled")
        else:
            own, other = [title, f.get("kjvName"), f.get("esvName")], f.get("aliases")
        for n in own:
            names[norm(n or "")].add(entity_id)
        for n in (other or "").split(","):
            aliases[norm(n)].add(entity_id)
    names.pop("", None)
    aliases.pop("", None)
    return names, aliases


def filed_verses(b, entry, keys, chapters, missing):
    """Verse Keys of every Verse an entry's references file, in the whole Bible. Adds the whole
    chapters it skips to `chapters` and counts its references to no Theographic verse."""
    found = set()
    for m in REF.finditer(entry):
        book = OSIS[m[1]]
        for seg in re.split(r"; (?:with )?", m[2]):
            ch, _, items = seg.partition(":")
            if not items:
                chapters.add(f"{book}.{ch}")
                continue
            for item in items.split(","):
                first, _, last = item.partition("-")
                last = last.replace(":", ".") if ":" in last else f"{ch}.{last or first}"
                ends = [f"{book}.{ch}.{first}", f"{book}.{last}"]
                start, end = (b.verse_keys.get(ref) for ref in ends)
                if not (start and end):
                    missing.update({ref for ref in ends if ref not in b.verse_keys})
                    continue
                found.update(keys[bisect_left(keys, start) : bisect_right(keys, end)])
    return found


def load(b):
    path = b.source("naves")
    with open(path, encoding="utf-8-sig", newline="") as f:
        headings = list(csv.DictReader(f))
    names, aliases = theographic_names(b)
    keys = sorted(set(b.verse_keys.values()))
    verses = {v["key"]: v for vs in b.chapters.values() for v in vs}
    for v in verses.values():
        v["filed_under"] = []
    naves = {"source": "Nave's Topical Bible", "licence": b.licence("naves")}

    b.new_report("removed_theme_headings", "heading", "action", "match", "entity_ids", "keep_row")
    in_range_chapters = {f"{book}.{ch}" for book, ch in b.chapters}
    chapters, missing = Counter(), Counter()
    for h in headings:
        heading, skipped = h["subject"], set()
        whole_bible = filed_verses(b, h["entry"], keys, skipped, missing)
        in_range = sorted(whole_bible & verses.keys())
        if not in_range:
            continue
        # "REBEKAH (REBECCA)" is Rebekah, as "Jacob (Israel)" is Jacob.
        forms = {norm(heading), norm(re.sub(r"\s*\(.*\)$", "", heading))}
        by_name = set().union(*(names.get(f, set()) for f in forms))
        by_alias = set().union(*(aliases.get(f, set()) for f in forms))
        if by_name or by_alias:
            match, ids = ("name", by_name) if by_name else ("alias", by_alias)
            keep = heading in b.themes_keep  # a reviewed themes_keep.csv row
            action = "kept" if keep else "removed"
        else:  # "ISRAEL, PROPHECIES CONCERNING" is a topic, so a part never removes a heading
            parts = {norm(p) for p in re.split(r"[,()]", heading)}
            action, match, keep = "kept", "part of the heading", False
            ids = set().union(*(names.get(p, set()) for p in parts))
        if ids:
            b.report(
                "removed_theme_headings",
                heading=heading,
                action=action,
                match=match,
                entity_ids=" ".join(sorted(ids)),
                keep_row="yes" if keep else "",
            )
        if action == "removed":
            continue
        theme_id = "theme:" + re.sub(r"[^a-z0-9]+", "_", heading.lower()).strip("_")
        if theme_id in b.entities:
            sys.exit(f"two Nave's headings give the ID {theme_id}")
        b.verse_sets[theme_id] = whole_bible
        b.entities[theme_id] = {
            "id": theme_id,
            "type": "theme",
            "name": heading,
            **naves,
            "verses": [verses[k] for k in in_range],  # replaced by Verse Neighbours
        }
        for k in in_range:
            verses[k]["filed_under"].append({"id": theme_id, "edge": "FILED_UNDER", **naves})
        chapters.update(skipped & in_range_chapters)
    for v in verses.values():
        v["filed_under"].sort(key=lambda x: x["id"])

    report_mismatches(b, chapters, "Nave's reference to a whole chapter (skipped, decision 59)")
    report_mismatches(
        b, missing, "Nave's reference to a verse that is not in Theographic (dropped)"
    )
