"""The TIPNR check (decision 7). Matches TIPNR People to Theographic People by name and verse
overlap, and reports People in the book range where the two disagree on identity or family links.

Nothing from TIPNR reaches the export: it asks not to be reposted (docs/licences.md 3.9). The
report names a TIPNR record only by its unique key, and writes TIPNR's family links as the
Theographic IDs they match.
"""

import json
import re
from collections import defaultdict

# TIPNR (STEP) book codes in canonical order: the n-th code is Theographic's book number n.
STEP_BOOKS = """Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro
Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act
Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev"""
FIELDS = ("father", "mother", "siblings", "partners", "children")


def norm(name):
    return re.sub(r"[^a-z]", "", name.lower())


def direct(keys):
    """Family keys, dropping those marked descended from (d), founder (f), or ancestor (a).
    Uncertain ones (?) are kept."""
    out = set()
    for k in filter(None, (k.strip() for k in keys.split(","))):
        m = re.fullmatch(r"(.+?)(?:\((\?|d\??|a|f)\))?", k)
        if m[2] in (None, "?"):
            out.add(m[1])
    return out


def people(path, books):
    """TIPNR PERSON records: unique key -> names, verses (OSIS), and a set of keys per field."""
    out = {}
    for block in path.read_text(encoding="utf-8").split("\n$========== ")[1:]:
        kind, head, *lines = block.splitlines()
        if kind.split("\t")[0] != "PERSON(s)":
            continue
        f = head.split("\t")
        key = f[0].split("=")[0]
        father, mother = f[2].split(" + ")
        r = out[key] = dict(zip(FIELDS, map(direct, (father, mother, f[3], f[4], f[5]))))
        r["names"], r["verses"] = {norm(key.split("@")[0])}, set()
        for sub in (line.split("\t") for line in lines if line.startswith("\u2013 ")):
            if sub[0] == "\u2013 Total" or len(sub) < 5:  # Total refs are abbreviated
                continue
            if not sub[0].startswith("\u2013 ("):  # "(same form with alt. meaning)": God, Lord
                r["names"] |= {norm(n.split("@")[0]) for n in sub[1].split("|")}
                # English forms: "Oholibamah =ESV,NIV; Aholibamah =KJV"
                forms = (n for part in sub[3].split(";") for n in part.split("=")[0].split(","))
                r["names"] |= {norm(n) for n in forms} - {""}
            for ref in sub[4].split(";"):  # "Gen.11.20", "Exo.7.10a"; skips "LXX Gen.11.20"
                m = re.fullmatch(r"(\w+)\.(\d+)\.(\d+)[a-e]?", ref.strip())
                if m and m[1] in books:
                    r["verses"].add(f"{books[m[1]]}.{m[2]}.{m[3]}")
    return out


def links(e):
    """A Person's family links as the edges step ships them: field -> Entity IDs."""
    out = {f: set() for f in FIELDS}
    for n in e["neighbours"]:
        for x in n["edges"]:
            if x["edge"] == "PARENT_OF":
                out[x["role"] if x["direction"] == "in" else "children"].add(n["id"])
            elif x["edge"] in ("SIBLING_OF", "HALF_SIBLING_OF"):
                out["siblings"].add(n["id"])
            elif x["edge"] == "PARTNER_OF":
                out["partners"].add(n["id"])
    return out


def load(b):
    order = {v["order"]: osis for osis, v in b.books.items()}
    books = {s: order[i] for i, s in enumerate(STEP_BOOKS.split(), 1) if i in order}
    tipnr = people(b.source("tipnr"), books)
    by_name = defaultdict(set)
    for key, r in tipnr.items():
        for n in r["names"]:
            by_name[n].add(key)

    # Each Theographic Person takes the TIPNR Person that shares a name and has the best
    # verse overlap (Jaccard). Overlap alone ties in genealogies.
    refs = {
        r["id"]: r["fields"]["osisRef"] for r in json.loads(b.source("theo-verses").read_text())
    }
    match = {}  # Theographic Entity ID -> TIPNR key
    for r in json.loads(b.source("theo-people").read_text()):
        f = r["fields"]
        verses = {refs[v] for v in f.get("verses") or [] if v in refs}
        names = [f["name"], *(f.get("alsoCalled") or "").split(",")]
        keys = {k for n in names for k in by_name.get(norm(n), ())}
        score, key = max(
            (
                (len(verses & tipnr[k]["verses"]) / len(verses | tipnr[k]["verses"]), k)
                for k in keys
            ),
            default=(0, None),
        )
        if score:
            match[f"person:{f['personLookup']}"] = key
    matched = defaultdict(set)  # TIPNR key -> Theographic Entity IDs
    for entity_id, key in match.items():
        matched[key].add(entity_id)

    b.new_report("tipnr_disagreements", "person", "tipnr_person", "field", "theographic", "tipnr")

    def report(e, key, field, theo, ids):
        b.report(
            "tipnr_disagreements",
            person=e["id"],
            tipnr_person=key,
            field=field,
            theographic=", ".join(sorted(theo)),
            tipnr=", ".join(sorted(ids)),
        )

    for e in b.entities.values():
        if e["type"] != "person" or not e["verses"]:
            continue
        if not (key := match.get(e["id"])):
            report(e, "", "identity", {e["id"]}, [])  # no TIPNR Person to compare with
            continue
        if len(matched[key]) > 1:  # Theographic has several People where TIPNR has one
            report(e, key, "identity", matched[key], [key])
        for field, theo in links(e).items():
            # Each TIPNR key as the Theographic People it matches; a key none matches stays a key.
            ids = [matched.get(k, {k}) for k in tipnr[key][field]]
            if not theo or not ids:
                continue  # one side names no one: a gap, not a disagreement (decision 71)
            if not all(i & theo for i in ids) or not theo <= set().union(*ids):
                report(e, key, field, theo, set().union(*ids))
