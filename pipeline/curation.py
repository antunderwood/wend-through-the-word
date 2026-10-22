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
- `b.links`: the family edges of `links.csv` to add or remove, each as ((from, edge, to), its
  curated item, True to add). The edges step applies them. This step applies the Mentions of
  `links.csv` itself, to the Verses, the Entities, and the whole-Bible Verse sets, and adds a
  "link" correction to each Entity at either end of a shipped row (#44). A Mention changes the
  Verses in range only for an Entity with a Verse in range.

Every row is checked against all of Theographic, not only the book range, so the reports do not
depend on the range. A row ships only when it is reviewed and still matches.
"""

import csv
import sys
from collections import defaultdict
from pathlib import Path

from pipeline import edges
from pipeline.entities import facts

CURATED = {"source": "Curated", "licence": "CC BY-SA 4.0"}
# partners.csv relation -> (edge, True when it runs from the woman to the man, None when it has
# no direction). One relation per row, so each edge carries only the evidence for it; a pair
# that is both wife and concubine has two rows.
RELATIONS = {
    "spouse": ("SPOUSE_OF", None),
    "concubine": ("CONCUBINE_OF", True),
    "partner": ("PARTNER_OF", None),
}
TABLES = {  # table -> the columns that name a row in the reports
    "partners": ("man_id", "woman_id"),
    "possibly_same": ("a_id", "b_id"),
    "corrections": ("id", "field"),
    "themes_keep": ("heading",),
    "links": ("action", "from", "link", "to"),
}
# links.csv: a Mention runs from a Verse (its label) to an Entity; PARENT_OF from the parent.
LINKS = ("MENTIONS", "PARENT_OF", "SIBLING_OF", "SPOUSE_OF")
UNDIRECTED = ("SIBLING_OF", "SPOUSE_OF")
STATUS_REPORTS = {"redundant": "curated_redundant", "stale": "curated_no_longer_matches"}
REPORTS = ("curated_unreviewed", *STATUS_REPORTS.values(), "curated_upstream")


def read(b):
    """Every row of every table as (table, line, row). Fails on a row with no valid evidence, a
    partner row whose relation is not one value, or a links row that does not name one link."""
    folder = Path(b.cfg.get("curated") or Path(__file__).parent / "curated")
    rows, errors = [], []
    for table in TABLES:
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
                if table == "partners" and row["relation"] not in (*RELATIONS, "none"):
                    choices = ", ".join((*RELATIONS, "none"))
                    errors.append(f"{where}: relation {row['relation']} is not one of {choices}")
                if table == "links":
                    x, link, y = row["from"], row["link"], row["to"]
                    if row["action"] not in ("add", "remove") or link not in LINKS:
                        choices = f"add or remove, then one of {', '.join(LINKS)}"
                        errors.append(f"{where}: {row['action']} {link} is not {choices}")
                    if link == "MENTIONS":
                        if x not in b.verse_keys:
                            errors.append(f"{where}: {x} is not a Verse Key")
                        x = b.verse_keys.get(x)
                    elif link in UNDIRECTED:
                        x, y = sorted((x, y))
                    row["edge"] = (x, link, y)  # as `theographic` holds it
                row["evidence"] = [{"verse_key": b.verse_keys.get(v), "label": v} for v in labels]
                rows.append((table, reader.line_num, row))
    if errors:
        sys.exit("curated tables: rows that do not parse\n" + "\n".join(errors))
    return rows


def theographic(b):
    """Every Theographic Entity ID -> its facts, every partner pair (sorted IDs), and every Mention
    and family edge as (from, edge, to): a Mention from its Verse Key."""
    upstream = {e: facts(kind, f, b.titles) for kind, _, f, e in b.records.values()}
    pairs = {
        tuple(sorted((entity_id, b.records[p][3])))
        for _, _, f, entity_id in b.records.values()
        for p in f.get("partners") or []
        if p in b.records
    }
    linked = {(k, "MENTIONS", e) for e, keys in b.verse_sets.items() for k in keys}
    linked |= {(x, edge, y) for x, edge, y, *_ in edges.links(b.records) if edge in LINKS}
    return upstream, pairs, linked


def check(table, row, upstream, pairs, linked):
    """("apply" or "redundant" or "stale", detail) for a row against Theographic."""
    ids = [row[c] for c in TABLES[table] if c.endswith("id")]
    if table == "links":
        ids = [row["to"]] if row["link"] == "MENTIONS" else [row["from"], row["to"]]
    for entity_id in ids:
        if entity_id not in upstream:
            return "stale", f"{entity_id} is not in Theographic"
    if table == "links":
        has = row["edge"] in linked
        if has == (row["action"] == "add"):
            return "redundant", f"Theographic {'now has' if has else 'no longer has'} the link"
        return "apply", ""
    if table == "partners":
        if tuple(sorted((row["man_id"], row["woman_id"]))) in pairs:
            return "apply", ""
        if row["relation"] == "none":
            return "redundant", "Theographic no longer has the pair"
        return "stale", "Theographic does not have the pair"
    if table in ("possibly_same", "themes_keep") or row["field"] == "coordinates":
        return "apply", ""  # Theographic coordinates never ship (decision 41): nothing to match
    was, value, now = row["was"], row["value"], upstream[row["id"]].get(row["field"])
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


def load(b):
    for name in REPORTS:
        b.new_report(name, "table", "line", "ids", "detail")
    upstream, pairs, linked = theographic(b)
    b.partners, b.possibly_same, b.corrections, b.themes_keep = {}, [], defaultdict(list), {}
    b.links = []
    for table, line, row in read(b):
        where = {"table": table, "line": line, "ids": " ".join(row[c] for c in TABLES[table])}
        status, detail = check(table, row, upstream, pairs, linked)
        if status != "apply":
            b.report(STATUS_REPORTS[status], **where, detail=detail)
        # PRD 10.5 rule 4. A coordinate is not Theographic's, so it is not reported upstream.
        plain_error = (
            (table == "corrections" and row["field"] != "coordinates")
            or row.get("relation") == "none"
            or table == "links"
        )
        if plain_error and status == "apply":
            b.report("curated_upstream", **where, detail=row["note"])
        if row["reviewed"] != "yes":
            b.report("curated_unreviewed", **where, detail=row["reviewed"])
            continue
        if status == "stale" or (table == "links" and status == "redundant"):
            continue  # a redundant link row would change nothing: Theographic agrees
        item = {**CURATED, **{k: row[k] for k in ("evidence", "note")}}
        item["request"] = row["request"] or None
        if table == "corrections":
            b.corrections[row["id"]].append(
                {**{k: row[k] for k in ("field", "was", "value")}, **item}
            )
        elif table == "themes_keep":
            b.themes_keep[row["heading"]] = {**item, "name": row["name"] or None}
        elif table == "possibly_same":
            b.possibly_same.append(
                (row["a_id"], row["b_id"], {"edge": "POSSIBLY_SAME_AS", **item}, False)
            )
        elif table == "links":
            add = row["action"] == "add"
            text = " ".join(row[c] for c in ("from", "link", "to"))
            # The "Corrected after review" marker, at each Entity end (decision 75).
            for entity_id in {row["edge"][0], row["edge"][2]} & upstream.keys():
                fix = {"field": "link", "was": "" if add else text, "value": text if add else ""}
                b.corrections[entity_id].append({**fix, **item})
            if row["link"] == "MENTIONS":
                mention(b, row["edge"], item, add)
            else:
                b.links.append((row["edge"], item, add))
        else:
            man, woman = row["man_id"], row["woman_id"]
            pair = b.partners.setdefault(tuple(sorted((man, woman))), [])
            if row["relation"] != "none":
                edge, from_woman = RELATIONS[row["relation"]]
                x, y = (woman, man) if from_woman else (man, woman)
                pair.append((x, y, {"edge": edge, **item}, from_woman is not None))
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
