"""PROTOTYPE, not a build step (data sources review R4/R5, section 8; decisions 217 and 221).

Measures what ACAI's word tags would add to the names rule for bold, using BibleAquifer's BSB
word alignment (CC BY-SA 4.0, written by language models, unreviewed). Nothing here reaches the
export and the alignment is not a pinned source: it is read from a local clone.

For each Person, Place and People Group that ACAI matches to a Theographic Entity (through
`alternate_sources.vizbible`), the words ACAI tags (`explicit_instances`: the name,
`pronominal_referents`: the pronouns and terms that refer to it) are followed through the alignment
to the BSB words, and compared with Theographic's Mentions and with the bold rule of
`web/src/bold.ts`, run as it ships (through `web/measure-hits.ts`).

Usage, from the repository root (a sources folder as for `pipeline.build`, plus the clone):
    python -m pipeline.acai_words build.toml ALIGNMENTS_JSON_DIR [OUT_REPORTS_DIR]
where ALIGNMENTS_JSON_DIR is `BereanStandardBible/eng/alignments/json`.

Reports (TSV, in OUT_REPORTS_DIR, default `<out>/reports`):
- `acai_words_summary.tsv`: the counts below, by type.
- `acai_words_terms.tsv`: for each BSB word ACAI tags as a pronoun or term, how many Mentions.
- `acai_words_gains.tsv`: each Mention the bold rule misses that ACAI's name tag finds, with words.
- `acai_words_referring.tsv`: each Mention where ACAI tags a pronoun or term, with the words and
  whether underlining them would also hit other words in the Verse (`safe` = no).
- `acai_words_only.tsv`: Mentions ACAI makes that Theographic does not, with the BSB words.
- `acai_words_unaligned.tsv`: ACAI tags with no BSB word, by cause.
"""

import csv
import json
import re
import subprocess
import sys
import tomllib
import zipfile
from collections import Counter, defaultdict
from functools import partial
from pathlib import Path

from pipeline import acai, curation, edges, entities, highlights, themes, tipnr, verses
from pipeline.common import Build

STEPS = [verses.load, entities.load, curation.load, entities.bsb_names, themes.load,
         entities.verse_neighbours, edges.load, highlights.load, tipnr.load, acai.load]  # fmt: skip
FOLDERS = ("people", "places", "groups", "deities", "keyterms")
TYPES = {"person", "place", "group"}
KINDS = {"explicit_instances": "name", "pronominal_referents": "term"}
# Words that are one of the speaker or hearer in every Verse; the review (decision 221) found
# roughly 20,000 of ACAI's pronoun tags are these.
BARE = {"i", "you", "he", "him", "his", "me", "my", "your", "they", "them", "their", "we", "us",
        "our", "she", "her", "it", "its", "who", "whom", "whose", "himself", "yourself"}  # fmt: skip
PRONOUNS = BARE | {"mine", "myself", "ourselves", "yours", "themselves", "herself", "itself",
                   "thee", "thou", "thy", "thine", "ye"}  # fmt: skip
# Words the alignment attaches to a tagged phrase, which name no one ("to", "the", "of").
STOP = {"to", "for", "of", "the", "a", "an", "with", "in", "on", "at", "by", "from", "and", "or",
        "is", "are", "was", "were", "be", "been", "that", "this", "these", "those", "all", "each",
        "own", "one", "it", "its", "so", "not", "no", "as", "than", "then", "who", "whom", "whose",
        "which", "what", "there", "has", "have", "had", "do", "does", "did", "will", "shall",
        "would", "may", "must", "can", "if", "when", "but", "up", "out", "into", "upon", "over"}  # fmt: skip


THIRD = {"he", "him", "his", "himself", "she", "her", "herself", "they", "them", "their", "themselves"}  # fmt: skip


def is_type(nodes, ty, pair):
    return nodes[pair[1]]["type"] == ty


def top_words(by_kind, kind):
    return "; ".join(f"{w} {n}" for w, n in by_kind[kind].most_common(8))


def content(words):
    """The words of a tag that can name or stand for someone: what is left of the BSB words the
    alignment gave once the function words are dropped."""
    return [w for w in words if w.lower() not in STOP]


def tokens(text):
    """The BSB's word tokens: the alignment counts words and each punctuation mark."""
    return re.findall(r"\w+(?:[’'-]\w+)*|[^\w\s]", text)


def read_alignments(folder, osis_of_order):
    """source word ID -> [(book OSIS, chapter, verse, token index, token text)], and the chapters
    with no alignment file."""
    by_source = defaultdict(list)
    seen = set()
    for path in sorted(Path(folder).glob("*.alignment.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        seen.add(path.name[:6])
        for rec in data["groups"][0]["records"]:
            targets = []
            for t in rec["target"]:
                ref, text = t.split("|", 1)
                osis = osis_of_order.get(int(ref[:2]))
                targets.append((osis, int(ref[2:5]), int(ref[5:8]), int(ref[8:]), text))
            for s in rec["source"]:
                by_source[s.split("|", 1)[0]].extend(targets)
    return by_source, seen


def measure_hits(root, nodes, pairs, texts):
    """Run the shipped bold rule (`web/src/bold.ts`) on (verse key, entity) pairs: a set of the
    pairs for which it bolds the node's name in the Verse's BSB text."""
    payload = {"nodes": nodes, "pairs": pairs, "texts": texts}
    out = subprocess.run(
        ["node", str(root / "web" / "measure-hits.ts")],
        input=json.dumps(payload), capture_output=True, text=True, check=True,
    ).stdout  # fmt: skip
    return {tuple(p) for p in json.loads(out)}


def run(cfg, alignments):
    b = Build(cfg)
    for step in STEPS:
        step(b)
    order = {v["order"]: osis for osis, v in b.books.items()}
    by_source, seen = read_alignments(alignments, order)
    missing = sorted(  # chapters of the Theographic book range the alignment has no file for
        f"{b.books[osis]['order']:02}-{ch:03}"
        for osis, ch in b.chapters
        if f"{b.books[osis]['order']:02}-{ch:03}" not in seen
    )

    entity_of = {rec: r[3] for rec, r in b.records.items()}
    acai_to_entities = defaultdict(set)
    acai_records = {}
    for r in read_records(b.source("acai")):
        acai_records[r["id"]] = r
        for rec in (r.get("alternate_sources") or {}).get("vizbible", []):
            if rec in entity_of:
                acai_to_entities[r["id"]].add(entity_of[rec])

    bsb_by_ref = {}  # (book OSIS, chapter, verse) -> BSB text in the BSB's own numbering
    for line in b.source("bsb").read_text(encoding="utf-8-sig").splitlines():
        if m := re.match(r"(.+) (\d+):(\d+)\t(.*)", line):
            osis = {v["name"]: k for k, v in b.books.items()}.get(
                verses.BSB_BOOK_NAMES.get(m[1], m[1])
            )
            bsb_by_ref[osis, int(m[2]), int(m[3])] = m[4].strip()

    unaligned = Counter()
    # (verse key, subject, kind) -> {(book, chapter, verse, token index): token text}; the subject
    # is a Theographic Entity ID, or "acai:<ACAI ID>" where ACAI has no single match.
    found = defaultdict(dict)
    for rid, r in acai_records.items():
        subject = min(acai_to_entities[rid]) if len(acai_to_entities[rid]) == 1 else None
        for field, kind in KINDS.items():
            for instances in (r.get(field) or {}).values():
                for ids in instances:
                    for wid in ids:
                        targets = by_source.get(wid[1:])
                        if not targets:
                            unaligned[r["type"], kind, "no alignment record"] += 1
                            continue
                        for osis, ch, vs, idx, text in targets:
                            key = b.verse_keys.get(b.to_kjv("bsb", f"{osis}.{ch}.{vs}"))
                            tk = tokens(bsb_by_ref.get((osis, ch, vs), ""))
                            if not key or idx > len(tk) or tk[idx - 1] != text:
                                unaligned[r["type"], kind, "token not in BSB text"] += 1
                                continue
                            found[key, subject or f"acai:{rid}", kind][osis, ch, vs, idx] = text
    return b, found, acai_records, unaligned, missing, acai_to_entities


def read_records(path):
    """Every ACAI record of the folders in `FOLDERS`, the shipped check's three and more."""
    out = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if re.fullmatch(rf"[^/]+/({'|'.join(FOLDERS)})/json/[^/]+\.json", name):
                out.append(json.loads(z.read(name)))
    return out


def write_tsv(folder, name, header, rows):
    with open(folder / f"{name}.tsv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def coverage(b, records, matches, reports):
    """How much of Theographic ACAI's `vizbible` IDs reach, by type, and which ACAI records name
    no Theographic Entity. For People, the TIPNR keys are a second route (`b.tipnr_match`)."""
    by_entity = defaultdict(set)  # Entity ID -> ACAI record IDs
    for rid, ids in matches.items():
        for i in ids:
            by_entity[i].add(rid)
    tipnr_keys = defaultdict(set)  # Entity ID -> ACAI records whose TIPNR key is the Entity's
    for rid, r in records.items():
        keys = {
            x
            for k in (r.get("alternate_sources") or {}).get("tipnr", [])
            for x in (k, k.split("|")[-1])
        }
        for ent, key in getattr(b, "tipnr_match", {}).items():
            if key in keys:
                tipnr_keys[ent].add(rid)
    rows = []
    for ty, folder in (("person", "person"), ("place", "place"), ("group", "group")):
        ents = [e for e in b.entities.values() if e["type"] == ty and e["verses"]]
        one = [e for e in ents if len(by_entity.get(e["id"], ())) == 1]
        several = [e for e in ents if len(by_entity.get(e["id"], ())) > 1]
        none = [e for e in ents if not by_entity.get(e["id"])]
        recs = [r for r in records.values() if r["type"] == ty]
        prim = [r for r in recs if r["id"] == r["primary_id"]]
        rows += [
            (ty, "theographic_entities_with_verses", len(ents)),
            (ty, "theographic_mentions", sum(len(e["verses"]) for e in ents)),
            (ty, "entities_with_one_acai_record", len(one)),
            (ty, "entities_with_several_acai_records", len(several)),
            (ty, "entities_with_no_acai_record", len(none)),
            (ty, "mentions_of_entities_with_no_acai_record", sum(len(e["verses"]) for e in none)),
            (ty, "entity_coverage_percent", round(100 * (len(one) + len(several)) / len(ents), 1) if ents else 0),
            (ty, "acai_records", len(recs)),
            (ty, "acai_primary_records", len(prim)),
            (ty, "acai_records_with_vizbible_id", sum(1 for r in recs if (r.get("alternate_sources") or {}).get("vizbible"))),
            (ty, "acai_records_resolving_to_an_entity", sum(1 for r in recs if matches.get(r["id"]))),
            (ty, "acai_records_with_tipnr_key", sum(1 for r in recs if (r.get("alternate_sources") or {}).get("tipnr"))),
            (ty, "acai_primary_records_resolving_to_no_entity", sum(1 for r in prim if not matches.get(r["id"]))),
        ]  # fmt: skip
        if ty == "person":
            rescued = [e for e in none if tipnr_keys.get(e["id"])]
            agree = [
                e
                for e in one
                if tipnr_keys.get(e["id"]) and tipnr_keys[e["id"]] & by_entity[e["id"]]
            ]
            disagree = [
                e
                for e in one
                if tipnr_keys.get(e["id"]) and not tipnr_keys[e["id"]] & by_entity[e["id"]]
            ]
            rows += [
                (ty, "no_vizbible_match_but_tipnr_key_match", len(rescued)),
                (ty, "vizbible_and_tipnr_routes_agree", len(agree)),
                (ty, "vizbible_and_tipnr_routes_disagree", len(disagree)),
            ]
            write_tsv(reports, "acai_crosswalk_routes", ("entity", "name", "vizbible_acai", "tipnr_acai"),
                      [(e["id"], e["name"], ", ".join(sorted(by_entity[e["id"]])), ", ".join(sorted(tipnr_keys[e["id"]])))
                       for e in disagree + rescued])  # fmt: skip
    write_tsv(reports, "acai_coverage", ("type", "measure", "value"), rows)
    write_tsv(reports, "acai_no_entity",  # ACAI primary records for People, Places and Groups naming no Entity
              ("acai_id", "type", "tipnr", "key_references"),
              [(r["id"], r["type"], ", ".join((r.get("alternate_sources") or {}).get("tipnr", [])),
                ", ".join((r.get("key_references") or [])[:3]))
               for r in sorted(records.values(), key=lambda r: r["id"])
               if r["type"] in TYPES and r["id"] == r["primary_id"] and not matches.get(r["id"])])  # fmt: skip


def unmatched(b, found, records, reports):
    """What ACAI tags with no Theographic Entity to join (Groups, Deities, Key Terms, and the
    People and Places without one): Verses and the BSB words, so the owner can see what a node
    for it would highlight. The Gentile group and the UncircumcisedPerson key term in full."""
    label = {v["key"]: v["label"] for vs in b.chapters.values() for v in vs}
    per = defaultdict(lambda: defaultdict(Counter))  # acai id -> kind -> BSB word -> Verses
    verses_of = defaultdict(set)
    for (k, who, kind), got in found.items():
        if who.startswith("acai:"):
            verses_of[who[5:]].add(k)
            for w in set(got.values()):
                per[who[5:]][kind][w] += 1
    rows = []
    for rid, vs in sorted(verses_of.items(), key=lambda kv: -len(kv[1])):
        r = records[rid]
        top = partial(top_words, per[rid])
        rows.append((rid, r["type"], len(vs), top("name"), top("term")))
    write_tsv(
        reports,
        "acai_words_unmatched",
        ("acai_id", "type", "verses", "name_words", "term_words"),
        rows,
    )
    detail = []
    for rid in ("group:Gentile", "keyterm:UncircumcisedPerson"):
        for k in sorted(verses_of.get(rid, ())):
            w = {kind: "; ".join(t for _, t in sorted(found[k, f"acai:{rid}", kind].items(), key=lambda kv: kv[0][3]))
                 for kind in KINDS.values() if (k, f"acai:{rid}", kind) in found}  # fmt: skip
            detail.append(
                (rid, label.get(k, k), w.get("name", ""), w.get("term", ""), b.bsb.get(k, ""))
            )
    write_tsv(
        reports,
        "acai_words_gentile",
        ("acai_id", "verse", "name_words", "term_words", "bsb_text"),
        detail,
    )


def analyse(b, found, records, matches, unaligned, reports, root):
    coverage(b, records, matches, reports)
    unmatched(b, found, records, reports)
    label = {v["key"]: v["label"] for vs in b.chapters.values() for v in vs}
    text_of = b.bsb
    nodes = {e["id"]: {"type": e["type"], "name": e.get("name") or e["title"],
                       "aliases": e.get("aliases", [])}
             for e in b.entities.values() if e["type"] in TYPES}  # fmt: skip
    theo = {(k, e["id"]) for e in b.entities.values() if e["type"] in TYPES
            for k in b.verse_sets.get(e["id"], ())}  # fmt: skip
    names = {(k, who) for (k, who, kind) in found if kind == "name" and who in nodes}
    terms = {(k, who) for (k, who, kind) in found if kind == "term" and who in nodes}
    texts = {k: text_of[k] for k, _ in theo | names | terms if k in text_of}
    pairs = sorted((k, w) for k, w in theo | names | terms if k in texts)
    hit = measure_hits(root, nodes, [list(p) for p in pairs], texts)

    def words(k, who, kind):
        got = found.get((k, who, kind), {})
        return [t for _, t in sorted(got.items(), key=lambda kv: kv[0][3])]

    def safe(k, who):
        """Whether every written place of each tagged word in the Verse is one ACAI tagged."""
        have = Counter(found.get((k, who, "term"), {}).values())
        written = Counter(tokens(texts[k]))
        return all(written[w] == n for w, n in have.items())

    summary = []
    gains, referring, only = [], [], []
    for ty in sorted(TYPES):
        mine = partial(is_type, nodes, ty)
        T = {p for p in theo if mine(p) and p[0] in texts}
        H = T & hit
        M = T - H
        N = {p for p in names if mine(p)}
        R = {p for p in terms if mine(p)}
        gain_name = M & N
        gain_term = (M & R) - N
        left = {p: content(words(*p, "term")) for p in R}
        pron = {p for p, w in left.items() if w and all(x.lower() in PRONOUNS for x in w)}
        term = {p for p, w in left.items() if any(x.lower() not in PRONOUNS for x in w)}
        cand_pron = {p for p in pron if safe(*p)}
        cand_term = {p for p in term if safe(*p)}
        third = {p for p in cand_pron if all(x.lower() in THIRD for x in left[p])}
        rows = [
            ("theographic_mentions", len(T)),
            ("bold_rule_hits", len(H)),
            ("bold_rule_misses", len(M)),
            ("bold_hit_percent", round(100 * len(H) / len(T), 1) if T else 0),
            ("misses_with_acai_name_word_in_bsb", len(gain_name)),
            ("misses_with_only_acai_term_word_in_bsb", len(gain_term)),
            ("misses_left", len(M - N - R)),
            ("verses_gaining_a_name_highlight", len({k for k, _ in gain_name})),
            ("acai_name_mentions_theographic_lacks", len(N - T)),
            ("acai_term_mentions_all", len(R)),
            ("acai_term_mentions_function_words_only", len(R) - len(pron) - len(term)),
            ("acai_term_mentions_pronouns_only", len(pron)),
            ("acai_term_mentions_with_a_noun_or_title", len(term)),
            ("underlinable_pronoun_mentions", len(cand_pron)),
            ("underlinable_third_person_pronoun_mentions", len(third)),
            ("underlinable_noun_or_title_mentions", len(cand_term)),
            (
                "underlinable_mentions_name_not_bold",
                len({p for p in cand_pron | cand_term if p not in H}),
            ),
            ("underlinable_verses", len({k for k, _ in cand_pron | cand_term})),
        ]
        summary += [(ty, k, v) for k, v in rows]
        for k, who in sorted(gain_name | gain_term):
            gains.append((ty, label[k], who, nodes[who]["name"],
                          "name" if (k, who) in N else "term",
                          "; ".join(words(k, who, "name") or words(k, who, "term")), texts[k]))  # fmt: skip
        for k, who in sorted(cand_pron | cand_term):
            referring.append((ty, label[k], who, nodes[who]["name"], "yes" if (k, who) in H else "no",
                              "pronoun" if (k, who) in cand_pron else "noun or title",
                              "; ".join(content(words(k, who, "term"))), texts[k]))  # fmt: skip
        for k, who in sorted(N - T):
            only.append((ty, label[k], who, nodes[who]["name"],
                         "bold" if (k, who) in hit else "not bold",
                         "; ".join(words(k, who, "name")), texts[k]))  # fmt: skip

    term_words = defaultdict(Counter)  # type -> word -> Mentions
    for (k, who, kind), got in found.items():
        if kind == "term" and who in nodes:
            for t in set(got.values()):
                term_words[nodes[who]["type"]][t] += 1
    write_tsv(reports, "acai_words_summary", ("type", "measure", "value"), summary)
    head = ("type", "verse", "entity", "name", "found_by", "bsb_words", "bsb_text")
    write_tsv(reports, "acai_words_gains", head, gains)
    write_tsv(reports, "acai_words_referring",
              ("type", "verse", "entity", "name", "name_already_bold", "kind", "bsb_words", "bsb_text"),
              referring)  # fmt: skip
    write_tsv(reports, "acai_words_only",
              ("type", "verse", "entity", "name", "bold_rule", "bsb_words", "bsb_text"), only)  # fmt: skip
    write_tsv(reports, "acai_words_terms", ("type", "bsb_word", "mentions"),
              [(ty, w, n) for ty, c in sorted(term_words.items()) for w, n in c.most_common(200)])  # fmt: skip
    write_tsv(reports, "acai_words_unaligned", ("type", "kind", "cause", "count"),
              [(*k, n) for k, n in sorted(unaligned.items())])  # fmt: skip
    return summary


def main(argv):
    cfg = tomllib.loads(Path(argv[0]).read_text())
    reports = Path(argv[2]) if len(argv) > 2 else Path(cfg["out"]) / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    b, found, records, unaligned, missing, matches = run(cfg, argv[1])
    for name in ("acai_disagreements", "acai_mentions", "acai_crosswalk"):  # the shipped check's
        header, rows = b.reports[name]
        write_tsv(reports, name, header, [[r[h] for h in header] for r in rows])
    print("chapters with no alignment file:", ", ".join(missing) or "none")
    for row in analyse(b, found, records, matches, unaligned, reports, Path(".")):
        print(*row, sep="\t")


if __name__ == "__main__":
    main(sys.argv[1:])
