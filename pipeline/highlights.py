"""Referring terms (decision 221): the words of a Verse's BSB text that refer to a node without
naming it, such as "his wife" for Rebekah in Gen 25:21. The front end underlines them where it
bolds names (decision 207).

They come only from the owner's curated table `highlights.csv`, one row per Verse and node:
`verse` (OSIS), `id` (Entity ID), `words` (exact BSB phrases, separated by ";"), `note`,
`reviewed`, `request`. The row's Verse is its evidence. Tools may suggest rows (ACAI's word tags
through the BSB alignment), but a row ships only when the owner has reviewed it, so nothing
machine-made ships.

Runs after `themes` (a row may name a Theme) and after every step that links Entities to Verses.
A row is checked against the whole Bible, not only the book range:
- its Verse is a Verse Key, and it has words (else the build fails);
- its node is an Entity linked to the Verse, and each phrase is in the Verse's BSB text as whole
  words (else `curated_no_longer_matches`, and it does not ship);
- it is reviewed (else `curated_unreviewed`).
A row that ships adds {id, words, source, licence, evidence, note, request} to the Verse's
`highlights` when the Verse is in range. Every place a phrase is written in the Verse is
underlined.
"""

import csv
import re
import sys
from pathlib import Path

from pipeline.curation import CURATED

TABLE = "highlights"


def whole_words(phrase, text):
    """Whether `phrase` is written in `text` as whole words."""
    return re.search(rf"(?<![\w’'-]){re.escape(phrase)}(?![\w-])", text) is not None


def read(b):
    """The rows of highlights.csv as (line, row, words). Fails on a row that does not parse."""
    folder = Path(b.cfg.get("curated") or Path(__file__).parent / "curated")
    rows, errors = [], []
    with open(folder / f"{TABLE}.csv", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            where = f"{TABLE}.csv line {reader.line_num}"
            words = [w.strip() for w in row["words"].split(";") if w.strip()]
            if row["verse"] not in b.verse_keys:
                errors.append(f"{where}: {row['verse']} is not a Verse Key")
            if not words:
                errors.append(f"{where}: no words")
            rows.append((reader.line_num, row, words))
    if errors:
        sys.exit("curated tables: rows that do not parse\n" + "\n".join(errors))
    return rows


def check(b, row, words):
    """None when the row still matches, else why not."""
    key, entity_id = b.verse_keys[row["verse"]], row["id"]
    if entity_id not in b.verse_sets:
        return f"{entity_id} is not an Entity"
    if key not in b.verse_sets[entity_id]:
        return f"{entity_id} is not linked to {row['verse']}"
    text = b.bsb.get(key, "")
    missing = [w for w in words if not whole_words(w, text)]
    return f"BSB {row['verse']} does not have {', '.join(missing)}" if missing else None


def load(b):
    in_range = {v["key"]: v for vs in b.chapters.values() for v in vs}
    for line, row, words in read(b):
        where = {"table": TABLE, "line": line, "ids": f"{row['verse']} {row['id']}"}
        if detail := check(b, row, words):
            b.report("curated_no_longer_matches", **where, detail=detail)
        if row["reviewed"] != "yes":
            b.report("curated_unreviewed", **where, detail=row["reviewed"])
            continue
        verse = in_range.get(b.verse_keys[row["verse"]])
        if detail or not verse:
            continue
        evidence = [{"verse_key": verse["key"], "label": row["verse"]}]
        item = {"id": row["id"], "words": words, **CURATED, "evidence": evidence}
        item |= {"note": row["note"], "request": row["request"] or None}
        verse.setdefault("highlights", []).append(item)
        verse["highlights"].sort(key=lambda h: h["id"])
