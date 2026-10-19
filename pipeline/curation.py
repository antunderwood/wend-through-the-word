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

Every row is checked against all of Theographic, not only the book range, so the reports do not
depend on the range. A row ships only when it is reviewed and still matches.
"""

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from pipeline.entities import TYPES, facts

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
}
STATUS_REPORTS = {"redundant": "curated_redundant", "stale": "curated_no_longer_matches"}
REPORTS = ("curated_unreviewed", *STATUS_REPORTS.values(), "curated_upstream")


def read(b):
    """Every row of every table as (table, line, row). Fails on a row with no valid evidence, or a
    partner row whose relation is not one value."""
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
                row["evidence"] = [{"verse_key": b.verse_keys.get(v), "label": v} for v in labels]
                rows.append((table, reader.line_num, row))
    if errors:
        sys.exit("curated tables: rows that do not parse\n" + "\n".join(errors))
    return rows


def theographic(b):
    """Every Theographic Entity ID -> its facts, and every partner pair (sorted IDs)."""
    upstream, ids, partners = {}, {}, []
    for kind, (source, name) in TYPES.items():
        records = json.loads(b.source(source).read_text())
        titles = {r["id"]: r["fields"].get("displayTitle") for r in records}
        for r in records:
            ids[r["id"]] = f"{kind}:{name(r['fields'])}"
            upstream[ids[r["id"]]] = facts(kind, r["fields"], titles)
            partners += [(r["id"], p) for p in r["fields"].get("partners") or []]
    pairs = {tuple(sorted((ids[x], ids[y]))) for x, y in partners if y in ids}
    return upstream, pairs


def check(table, row, upstream, pairs):
    """("apply" or "redundant" or "stale", detail) for a row against Theographic."""
    for entity_id in (row[c] for c in TABLES[table] if c.endswith("id")):
        if entity_id not in upstream:
            return "stale", f"{entity_id} is not in Theographic"
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
    upstream, pairs = theographic(b)
    b.partners, b.possibly_same, b.corrections, b.themes_keep = {}, [], defaultdict(list), {}
    for table, line, row in read(b):
        where = {"table": table, "line": line, "ids": " ".join(row[c] for c in TABLES[table])}
        status, detail = check(table, row, upstream, pairs)
        if status != "apply":
            b.report(STATUS_REPORTS[status], **where, detail=detail)
        # PRD 10.5 rule 4. A coordinate is not Theographic's, so it is not reported upstream.
        plain_error = (table == "corrections" and row["field"] != "coordinates") or (
            row.get("relation") == "none"
        )
        if plain_error and status == "apply":
            b.report("curated_upstream", **where, detail=row["note"])
        if row["reviewed"] != "yes":
            b.report("curated_unreviewed", **where, detail=row["reviewed"])
            continue
        if status == "stale":
            continue
        item = {**CURATED, **{k: row[k] for k in ("evidence", "note")}}
        item["request"] = row["request"] or None
        if table == "corrections":
            b.corrections[row["id"]].append(
                {**{k: row[k] for k in ("field", "was", "value")}, **item}
            )
        elif table == "themes_keep":
            b.themes_keep[row["heading"]] = item
        elif table == "possibly_same":
            b.possibly_same.append(
                (row["a_id"], row["b_id"], {"edge": "POSSIBLY_SAME_AS", **item}, False)
            )
        else:
            man, woman = row["man_id"], row["woman_id"]
            edges = b.partners.setdefault(tuple(sorted((man, woman))), [])
            if row["relation"] != "none":
                edge, from_woman = RELATIONS[row["relation"]]
                x, y = (woman, man) if from_woman else (man, woman)
                edges.append((x, y, {"edge": edge, **item}, from_woman is not None))
    for e in b.entities.values():
        correct(b, e)


def correct(b, e):
    """Apply the shipped corrections of one Entity, each marked in its `corrections` list."""
    for row in b.corrections.get(e["id"], []):
        if row["field"] == "aliases":
            aliases = e["aliases"]
            if row["was"] in aliases:
                aliases[aliases.index(row["was"])] = row["value"]
            e["aliases"] = [a for a in dict.fromkeys(aliases) if a]
        elif row["field"] != "coordinates":  # the coordinates step applies these
            e[row["field"]] = row["value"]
        e.setdefault("corrections", []).append(row)


def report_aliases(b):
    """Every alias the build ships, so the owner can spot notes in alias fields (#7)."""
    b.new_report("aliases", "id", "alias")
    for e in b.entities.values():
        for alias in e.get("aliases", []):
            b.report("aliases", id=e["id"], alias=alias)
