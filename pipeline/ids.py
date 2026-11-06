"""Published Entity IDs (decision 215, #124). An Entity ID that a release has shipped is a public
contract: shared links, journey notes, Your Path and Correction Requests hold it. So an ID never
disappears silently.

- `pipeline/ids.tsv` (config key `ids`; `build.toml` sets it) lists every Entity ID a released export has shipped, with
  the data version that first shipped it. `python -m pipeline.ids record OUT` adds the IDs of an
  export folder (a build's `out`, or an unzipped release).
- `id_redirects.csv` in the curated folder says, for a published ID that no longer ships, which ID
  replaces it, or (an empty `to`) that it was removed. Only reviewed rows apply.

`check` runs inside the export step, once the shipped Entities are known. With no `ids` key (a
test build of a few books) it does nothing. Otherwise it reports `ids_new`,
`ids_missing` and `id_redirects_invalid`, and returns the redirects to write and the problems
that fail the build after the reports are written.

Usage:
    python -m pipeline.ids record OUT [--ids pipeline/ids.tsv]
"""

import argparse
import csv
import json
import sys
from pathlib import Path

REGISTRY = Path(__file__).parent / "ids.tsv"
HEADER = ("id", "first_version")


def read_registry(path):
    """ID -> the data version that first shipped it. A missing file is an empty registry."""
    if not path.exists():
        return {}
    with open(path, newline="") as f:
        return {r["id"]: r["first_version"] for r in csv.DictReader(f, delimiter="\t")}


def write_registry(path, known):
    lines = ["\t".join(HEADER)] + [f"{i}\t{v}" for i, v in sorted(known.items())]
    path.write_text("\n".join(lines) + "\n")


def read_redirects(folder):
    path = folder / "id_redirects.csv"
    if not path.exists():
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def check(b):
    """Compare the Entities this build ships with the registry. Returns (redirects, problems):
    redirects is old ID -> new ID or None, for `redirects.json`; problems fail the build."""
    if not b.cfg.get("ids"):  # a test build of a few books; the release refuses its export
        return {}, []
    known = read_registry(Path(b.cfg["ids"]))
    folder = Path(b.cfg.get("curated") or Path(__file__).parent / "curated")
    shipped = set(b.entities)
    b.new_report("ids_new", "id", "type")
    b.new_report("ids_missing", "id", "first_version")
    b.new_report("id_redirects_invalid", "id", "to", "cause")

    for entity_id in sorted(shipped - known.keys()):
        b.report("ids_new", id=entity_id, type=entity_id.split(":", 1)[0])

    redirects, problems = {}, []
    for row in read_redirects(folder):
        old, new = row["id"].strip(), row["to"].strip() or None
        if row["reviewed"].strip() != "yes":
            continue  # like every curated table: only reviewed rows ship
        cause = None
        if old in shipped:
            cause = "the ID still ships"
        elif new and new not in shipped:
            cause = "the target does not ship"
        elif old in redirects:
            cause = "two rows for one ID"
        if cause:
            b.report("id_redirects_invalid", id=old, to=new or "", cause=cause)
            problems.append(f"id_redirects.csv: {old}: {cause}")
            continue
        redirects[old] = new

    for entity_id in sorted(known.keys() - shipped - redirects.keys()):
        b.report("ids_missing", id=entity_id, first_version=known[entity_id])
    if missing := len(b.reports["ids_missing"][1]):
        problems.append(
            f"{missing} published IDs no longer ship and have no reviewed row in "
            "id_redirects.csv: see reports/ids_missing.tsv"
        )
    return redirects, problems


def shipped_ids(out):
    """The data version and Entity IDs of an export folder (one with `data/index.json`)."""
    version = json.loads((out / "data" / "index.json").read_text())["data_version"]
    entity = out / "data" / version / "entity"
    if not entity.is_dir():
        sys.exit(f"{entity} is not a folder")
    return version, {f"{p.parent.name}:{p.stem}" for p in entity.glob("*/*.json")}


def record(out, path=REGISTRY):
    """Add the export's Entity IDs that the registry lacks, with the export's data version.
    Rows already there keep their first version. Returns the number added."""
    version, ids = shipped_ids(out)
    known = read_registry(path)
    added = {i: version for i in ids - known.keys()}
    write_registry(path, known | added)
    return len(added)


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m pipeline.ids")
    p.add_argument("command", choices=["record"])
    p.add_argument("out", type=Path, help="an export folder: a build's out, or an unzipped release")
    p.add_argument("--ids", type=Path, default=REGISTRY)
    a = p.parse_args(argv)
    print(f"{record(a.out, a.ids)} IDs added to {a.ids}")


if __name__ == "__main__":
    main()
