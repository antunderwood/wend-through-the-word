# PROTOTYPE, throwaway. Builds the Genesis graph for focus-model.prototype.html.
# Usage: python3 -I build_data.py <source dir with theo/, bsb/, xref/>
import csv, json, math, re, sys
from collections import defaultdict
from pathlib import Path

src = Path(sys.argv[1])
here = Path(__file__).parent
load = lambda n: json.load(open(src / "theo" / f"{n}.json"))

verses = {r["id"]: r["fields"] for r in load("verses") if r["fields"]["osisRef"].startswith("Gen.")}
osis_to_key = {f["osisRef"]: f["verseID"] for f in verses.values()}

bsb = {}
for line in open(src / "bsb" / "bsb.txt", encoding="utf-8-sig"):
    m = re.match(r"Genesis (\d+):(\d+)\t(.*)", line.rstrip("\n"))
    if m:
        bsb[f"Gen.{m[1]}.{m[2]}"] = m[3]

nodes = {}       # id -> [type, label, verse text]
info = {}        # id -> {"d": Easton's text, "y": event year}
def easton(f):
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", "\n\n".join(f.get("dictText") or []))
    return t[:1500] + ("..." if len(t) > 1500 else "")
vsets = {}       # entity id -> set of verse keys
rec = {}         # airtable record id -> node id
for kind, table, lk, lab in [("person", "people", "personLookup", "displayTitle"),
                             ("place", "places", "placeLookup", "displayTitle"),
                             ("event", "events", "eventID", "title")]:
    for r in load(table):
        f = r["fields"]
        vs = {verses[v]["verseID"] for v in f.get("verses") or [] if v in verses}
        if not vs:
            continue
        nid = f"{kind}:{f[lk]}"
        rec[r["id"]] = nid
        nodes[nid] = [kind, f.get(lab) or f.get("name") or str(f[lk]), "", (f.get("gender") or "")[:1]]
        vsets[nid] = vs
        d = {"d": easton(f)} if f.get("dictText") else {}
        if kind == "event" and f.get("startDate"):
            n = int(f["startDate"])  # astronomical numbering: 0 is 1 BC
            d["y"] = f"{1 - n} BC" if n <= 0 else f"AD {n}"
        if d:
            info[nid] = d

for f in verses.values():
    _, c, v = f["osisRef"].split(".")
    nodes[f"verse:{f['verseID']}"] = ["verse", f"Gen {c}:{v}", bsb.get(f["osisRef"], "")]

edges = defaultdict(lambda: [set(), None])  # (a,b) sorted -> [edge types, weight]
DIRECTED = {"PARENT_OF", "BORN_AT", "DIED_AT", "PARTICIPATED_IN", "OCCURRED_AT", "MEMBER_OF", "SPOUSE_OF", "CONCUBINE_OF"}
# Curated partner table: replaces Theographic's undivided PARTNER_OF where a verse says wife or concubine.
curated = {tuple(sorted((r["man_id"], r["woman_id"]))): r
           for r in csv.DictReader(open(here.parent.parent / "pipeline" / "curated" / "partners.csv"))}
evidence = {}
corrections = list(csv.DictReader(open(here.parent.parent / "pipeline" / "curated" / "corrections.csv")))
possibly_same = list(csv.DictReader(open(here.parent.parent / "pipeline" / "curated" / "possibly_same.csv")))
shared_n = {}
def add(a, b, t, w=None):
    # Reads "a t b". Directed types keep their direction: ">" means the first id of the pair is the source.
    if a in nodes and b in nodes and a != b:
        key = tuple(sorted((a, b)))
        e = edges[key]
        e[0].add(t + (">" if key[0] == a else "<") if t in DIRECTED else t)
        if w is not None:
            e[1] = w if e[1] is None else max(e[1], w)

for r in load("peopleGroups"):
    f = r["fields"]
    members = [rec[m] for m in f.get("members") or [] if m in rec]
    if members:
        gid = f"group:{f['groupName'].lower().replace(' ', '_')}"
        nodes[gid] = ["group", f["groupName"], ""]
        for m in members:
            add(m, gid, "MEMBER_OF")

for r in load("people"):
    a = rec.get(r["id"]); f = r["fields"]
    if not a:
        continue
    for b in (f.get("father") or []) + (f.get("mother") or []):
        add(rec.get(b), a, "PARENT_OF")
    for b in f.get("partners") or []:
        b = rec.get(b)
        r = curated.get(tuple(sorted((a, b or ""))))
        if r and r["relation"] == "none":
            continue
        if r and r["relation"] != "partner":
            for rel in r["relation"].split(";"):
                add(r["man_id"], r["woman_id"], rel.upper() + "_OF")
            evidence["|".join(sorted((a, b)))] = r["evidence"]
        else:
            add(a, b, "PARTNER_OF")
    for fld, t in [("siblings", "SIBLING_OF"), ("children", "PARENT_OF"),
                   ("halfSiblingsSameFather", "HALF_SIBLING_OF"), ("halfSiblingsSameMother", "HALF_SIBLING_OF"),
                   ("birthPlace", "BORN_AT"), ("deathPlace", "DIED_AT")]:
        for b in f.get(fld) or []:
            add(a, rec.get(b), t)
for r in possibly_same:
    add(r["a_id"], r["b_id"], "POSSIBLY_SAME_AS")
    evidence["|".join(sorted((r["a_id"], r["b_id"])))] = r["evidence"]
for r in corrections:
    if r["field"] == "gender" and r["id"] in nodes:
        nodes[r["id"]][3] = r["value"]
for r in load("events"):
    a = rec.get(r["id"]); f = r["fields"]
    if a:
        for b in f.get("participants") or []: add(rec.get(b), a, "PARTICIPATED_IN")
        for b in f.get("locations") or []: add(a, rec.get(b), "OCCURRED_AT")

# MENTIONS: weight of a verse, seen from an entity, is the number of other entities in it (heuristic).
in_verse = defaultdict(set)
for e, vs in vsets.items():
    for v in vs:
        in_verse[v].add(e)
for v, es in in_verse.items():
    for e in es:
        add(e, f"verse:{v}", "MENTIONS", len(es) - 1)

# CO_MENTION, cosine over Genesis verses. ponytail: O(pairs per verse), fine for one book.
shared = defaultdict(int)
for es in in_verse.values():
    es = sorted(es)
    for i, a in enumerate(es):
        for b in es[i + 1:]:
            shared[(a, b)] += 1
for (a, b), n in shared.items():
    add(a, b, "CO_MENTION", n / math.sqrt(len(vsets[a]) * len(vsets[b])))
    shared_n[(a, b)] = n

xr = 0
for line in open(src / "xref" / "cross_references.txt"):
    p = line.rstrip("\n").split("\t")
    if len(p) == 3 and p[0] in osis_to_key and p[1] in osis_to_key:
        add(f"verse:{osis_to_key[p[0]]}", f"verse:{osis_to_key[p[1]]}", "CROSS_REF", int(p[2]))
        xr += 1

data = {"nodes": nodes, "info": info, "evidence": evidence,
        "edges": [[a, b, "+".join(sorted(t)), round(w or 0, 4), shared_n.get((a, b), 0)] for (a, b), (t, w) in edges.items()]}
blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
tpl = (here / "focus-model.template.html").read_text()
(here / "focus-model.prototype.html").write_text(tpl.replace("/*DATA*/null", blob))
print(f"{len(nodes)} nodes, {len(edges)} edges ({xr} Genesis to Genesis cross-refs), {len(blob)//1024} KB")
