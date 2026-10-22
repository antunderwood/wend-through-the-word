"""The owner's curated tables over Theographic (spec "Curated tables", PRD 10.5).

Runs after `entities`, before `themes` and before `edges`, so that a gender correction changes
the PARENT_OF role (decision 69). Sets:

- `b.partners`: Theographic partner pair (sorted IDs) -> its curated edges, each as
  (from, to, item, directed). The edges step uses them in place of PARTNER_OF; "none" gives [].
- `b.possibly_same`: POSSIBLY_SAME_AS edges, in the same form.
- `b.corrections`: Entity ID -> correction rows to apply. `correct` applies them; the edges step
  calls it for each stub too.
- `b.themes_keep`: Nave's heading -> its curated item. The themes step keeps these headings as
  Themes even when they match a Theographic Person or Place (decision 99, amended).
- `b.links`: the family edges of `links.csv` to add or remove, each a LinkFix. The edges step
  applies them. This step applies the Mentions of `links.csv` itself, to the Verses, the
  Entities, and the whole-Bible Verse sets, and adds a "link" correction to each Entity at either
  end of a shipped row (#44). A Mention changes the Verses in range only for an Entity with a
  Verse in range.

Every row is checked against all of Theographic, not only the book range, so the reports do not
depend on the range. A row ships only when it is reviewed and still matches. Each table has one
handler, a Table, in TABLES.
"""

import csv
import sys
from collections import defaultdict
from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple

from pipeline.entities import Edge, facts, links

CURATED = {"source": "Curated", "licence": "CC BY-SA 4.0"}
# partners.csv relation -> (edge, True when it runs from the woman to the man, None when it has
# no direction). One relation per row, so each edge carries only the evidence for it; a pair
# that is both wife and concubine has two rows.
RELATIONS = {
    "spouse": ("SPOUSE_OF", None),
    "concubine": ("CONCUBINE_OF", True),
    "partner": ("PARTNER_OF", None),
}
# links.csv: a Mention runs from a Verse (its label) to an Entity; PARENT_OF from the parent.
LINKS = ("MENTIONS", "PARENT_OF", "SIBLING_OF", "SPOUSE_OF")
UNDIRECTED = ("SIBLING_OF", "SPOUSE_OF")
STATUS_REPORTS = {"redundant": "curated_redundant", "stale": "curated_no_longer_matches"}
REPORTS = ("curated_unreviewed", *STATUS_REPORTS.values(), "curated_upstream")


class Theographic(NamedTuple):
    entities: dict  # every Theographic Entity ID -> its facts
    pairs: set  # every partner pair (sorted IDs)
    linked: set  # every Mention (from its Verse Key) and family edge, as an Edge


class LinkFix(NamedTuple):
    key: Edge
    item: dict  # the curated item
    add: bool  # False to remove


class Table(NamedTuple):
    """How rows of one curated table are read, checked, and applied."""

    ids: tuple  # the columns that name a row in the reports
    check: Callable  # (row, Theographic) -> ("apply", "redundant" or "stale", detail)
    apply: Callable  # (b, row, its curated item, Theographic), for a row that ships
    parse: Callable = lambda b, row: []  # (b, row) -> what does not parse, beyond the evidence
    # Whether an applied row is a Theographic error to report upstream (PRD 10.5 rule 4).
    upstream: Callable = lambda row: False
    redundant_ships: bool = True  # False when a redundant row would change nothing


def read(b):
    """Every row of every table as (table, line, row). Fails on a row with no valid evidence, or
    one its table's `parse` rejects."""
    folder = Path(b.cfg.get("curated") or Path(__file__).parent / "curated")
    rows, errors = [], []
    for table, handler in TABLES.items():
        with open(folder / f"{table}.csv", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                where = f"{table}.csv line {reader.line_num}"
                labels = [v.strip() for v in row["evidence"].split(";") if v.strip()]
                if not labels:
                    errors.append(f"{where}: no Evidence Verse")
                errors += [
                    f"{where}: {v} is not a Verse Key" for v in labels if v not in b.verse_keys
                ]
                errors += [f"{where}: {e}" for e in handler.parse(b, row)]
                row["evidence"] = [{"verse_key": b.verse_keys.get(v), "label": v} for v in labels]
                rows.append((table, reader.line_num, row))
    if errors:
        sys.exit("curated tables: rows that do not parse\n" + "\n".join(errors))
    return rows


def theographic(b):
    upstream = {e: facts(kind, f, b.titles) for kind, _, f, e in b.records.values()}
    pairs = {
        tuple(sorted((entity_id, b.records[p][3])))
        for _, _, f, entity_id in b.records.values()
        for p in f.get("partners") or []
        if p in b.records
    }
    linked = {(k, "MENTIONS", e) for e, keys in b.verse_sets.items() for k in keys}
    linked |= {x.key for x in links(b.records) if x.key.edge in LINKS}
    return Theographic(upstream, pairs, linked)


def stale(ids, up):
    """("stale", detail) for the first of `ids` that is not a Theographic Entity, else None."""
    for entity_id in ids:
        if entity_id not in up.entities:
            return "stale", f"{entity_id} is not in Theographic"
    return None


# partners.csv


def parse_partner(b, row):
    if row["relation"] in (*RELATIONS, "none"):
        return []
    return [f"relation {row['relation']} is not one of {', '.join((*RELATIONS, 'none'))}"]


def check_partner(row, up):
    if found := stale((row["man_id"], row["woman_id"]), up):
        return found
    if tuple(sorted((row["man_id"], row["woman_id"]))) in up.pairs:
        return "apply", ""
    if row["relation"] == "none":
        return "redundant", "Theographic no longer has the pair"
    return "stale", "Theographic does not have the pair"


def apply_partner(b, row, item, up):
    man, woman = row["man_id"], row["woman_id"]
    pair = b.partners.setdefault(tuple(sorted((man, woman))), [])
    if row["relation"] != "none":
        edge, from_woman = RELATIONS[row["relation"]]
        x, y = (woman, man) if from_woman else (man, woman)
        pair.append((x, y, {"edge": edge, **item}, from_woman is not None))


# possibly_same.csv


def check_possibly_same(row, up):
    return stale((row["a_id"], row["b_id"]), up) or ("apply", "")


def apply_possibly_same(b, row, item, up):
    b.possibly_same.append((row["a_id"], row["b_id"], {"edge": "POSSIBLY_SAME_AS", **item}, False))


# corrections.csv


def check_correction(row, up):
    if found := stale((row["id"],), up):
        return found
    if row["field"] == "coordinates":
        return "apply", ""  # Theographic coordinates never ship (decision 41): nothing to match
    was, value, now = row["was"], row["value"], up.entities[row["id"]].get(row["field"])
    if row["field"] == "aliases":  # one alias: `was` is replaced by `value`, or removed
        now = now or []
        if was in now:
            return "apply", ""
        if value in now or not value:
            return "redundant", f"Theographic no longer has the alias {was}"
        return "stale", f"Theographic has neither alias, {was} or {value}"
    if now == was:
        return "apply", ""
    if now == value:
        return "redundant", f"Theographic now has {value}"
    return "stale", f"Theographic has {now}, not {was} or {value}"


def apply_correction(b, row, item, up):
    b.corrections[row["id"]].append({**{k: row[k] for k in ("field", "was", "value")}, **item})


# themes_keep.csv


def apply_theme(b, row, item, up):
    b.themes_keep[row["heading"]] = {**item, "name": row["name"] or None}


# links.csv


def parse_link(b, row):
    """Sets `edge`, the Edge as Theographic holds it."""
    errors = []
    x, link, y = row["from"], row["link"], row["to"]
    if row["action"] not in ("add", "remove") or link not in LINKS:
        choices = f"add or remove, then one of {', '.join(LINKS)}"
        errors.append(f"{row['action']} {link} is not {choices}")
    if link == "MENTIONS":
        if x not in b.verse_keys:
            errors.append(f"{x} is not a Verse Key")
        x = b.verse_keys.get(x)
    elif link in UNDIRECTED:
        x, y = sorted((x, y))
    row["edge"] = Edge(x, link, y)
    return errors


def check_link(row, up):
    ends = [row["to"]] if row["link"] == "MENTIONS" else [row["from"], row["to"]]
    if found := stale(ends, up):
        return found
    has = row["edge"] in up.linked
    if has == (row["action"] == "add"):
        return "redundant", f"Theographic {'now has' if has else 'no longer has'} the link"
    return "apply", ""


def apply_link(b, row, item, up):
    add, key = row["action"] == "add", row["edge"]
    text = " ".join(row[c] for c in ("from", "link", "to"))
    # The "Corrected after review" marker, at each Entity end (decision 75).
    for entity_id in {key.start, key.end} & up.entities.keys():
        fix = {"field": "link", "was": "" if add else text, "value": text if add else ""}
        b.corrections[entity_id].append({**fix, **item})
    if row["link"] == "MENTIONS":
        mention(b, key, item, add)
    else:
        b.links.append(LinkFix(key, item, add))


TABLES = {
    "partners": Table(
        ("man_id", "woman_id"),
        check_partner,
        apply_partner,
        parse_partner,
        upstream=lambda row: row["relation"] == "none",
    ),
    "possibly_same": Table(("a_id", "b_id"), check_possibly_same, apply_possibly_same),
    # A coordinate is not Theographic's, so it is not reported upstream.
    "corrections": Table(
        ("id", "field"),
        check_correction,
        apply_correction,
        upstream=lambda row: row["field"] != "coordinates",
    ),
    "themes_keep": Table(("heading",), lambda row, up: ("apply", ""), apply_theme),
    "links": Table(
        ("action", "from", "link", "to"),
        check_link,
        apply_link,
        parse_link,
        upstream=lambda row: True,
        redundant_ships=False,  # Theographic already agrees
    ),
}


def load(b):
    for name in REPORTS:
        b.new_report(name, "table", "line", "ids", "detail")
    up = theographic(b)
    b.partners, b.possibly_same, b.corrections, b.themes_keep = {}, [], defaultdict(list), {}
    b.links = []
    for table, line, row in read(b):
        handler = TABLES[table]
        where = {"table": table, "line": line, "ids": " ".join(row[c] for c in handler.ids)}
        status, detail = handler.check(row, up)
        if status != "apply":
            b.report(STATUS_REPORTS[status], **where, detail=detail)
        if status == "apply" and handler.upstream(row):
            b.report("curated_upstream", **where, detail=row["note"])
        if row["reviewed"] != "yes":
            b.report("curated_unreviewed", **where, detail=row["reviewed"])
            continue
        if status == "stale" or (status == "redundant" and not handler.redundant_ships):
            continue
        item = {**CURATED, **{k: row[k] for k in ("evidence", "note")}}
        item["request"] = row["request"] or None
        handler.apply(b, row, item, up)
    for e in b.entities.values():
        correct(b, e)


def mention(b, key, item, add):
    """Add or remove a Mention (Verse Key, MENTIONS, Entity ID) in the Entity's whole-Bible Verse
    set, and in the Verse and the Entity when both are in range."""
    verse_key, _, entity_id = key
    if add:
        b.verse_sets[entity_id].add(verse_key)
    else:
        b.verse_sets[entity_id].discard(verse_key)
    verse = next((v for v in b.verse_recs.values() if v and v["key"] == verse_key), None)
    e = b.entities.get(entity_id)
    if not (verse and e):
        return
    verse["mentions"] = [m for m in verse["mentions"] if m["id"] != entity_id]
    e["verses"] = [v for v in e["verses"] if v is not verse]
    if add:
        verse["mentions"].append({"id": entity_id, "edge": "MENTIONS", **item})
        verse["mentions"].sort(key=lambda m: m["id"])
        e["verses"].append(verse)


def correct(b, e):
    """Apply the shipped corrections of one Entity, each marked in its `corrections` list."""
    for row in b.corrections.get(e["id"], []):
        if row["field"] == "aliases":
            aliases = e["aliases"]
            if row["was"] in aliases:
                aliases[aliases.index(row["was"])] = row["value"]
            e["aliases"] = [a for a in dict.fromkeys(aliases) if a]
        elif row["field"] not in ("coordinates", "link"):  # a point or a link: applied elsewhere
            e[row["field"]] = row["value"]
        e.setdefault("corrections", []).append(row)


def report_aliases(b):
    """Every alias the build ships, so the owner can spot notes in alias fields (#7)."""
    b.new_report("aliases", "id", "alias")
    for e in b.entities.values():
        for alias in e.get("aliases", []):
            b.report("aliases", id=e["id"], alias=alias)
