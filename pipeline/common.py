"""Shared state and helpers for the build steps."""

import json
import re
from pathlib import Path

from pipeline.download import SOURCES, file_name

SIZE_LIMIT = 500 * 1000  # bytes, PRD 8.2
# Ring 2 entries kept for each node; the browser filters these and shows 3 (PRD 10.4).
RING2_TOP = 10


class Build:
    """State passed through the steps. Each step reads what earlier steps set and adds its own
    attributes (for example `chapters`, `entities`). Only `export` writes data files."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.out = Path(cfg["out"])
        self.used = set()  # source names read by this build, for index.json and credits
        self.reports = {}  # report name -> (header, rows); every declared report is written
        self.size_limit = cfg.get("size_limit", SIZE_LIMIT)  # lower only in tests

    def source(self, name):
        """Path of a downloaded source. Records that this build used it."""
        self.used.add(name)
        return Path(self.cfg["sources"]) / file_name(SOURCES[name][0])

    def licence(self, name):
        return SOURCES[name][1]

    def new_report(self, name, *header):
        self.reports[name] = (header, [])

    def report(self, name, **row):
        self.reports[name][1].append(row)


def norm(name):
    """A name in lower case with every character that is not a letter removed, for matching."""
    return re.sub(r"[^a-z]", "", name.lower())


def ring2_entries(neighbours):
    """The top Neighbours of a ranked list as Ring 2 entries: ID and weight only (spec)."""
    return [{"id": n["id"], "weight": n["weight"]} for n in neighbours[:RING2_TOP]]


def report_mismatches(b, counts, cause):
    """List each verse reference in `counts` (reference -> count) in `verse_mismatches.tsv`."""
    for verse, count in counts.items():
        b.report("verse_mismatches", verse=verse, cause=cause, count=count)


def to_json(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, indent=1) + "\n"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_json(data))


def write_tsv(path, header, rows):
    lines = ["\t".join(header)] + ["\t".join(str(r[h]) for h in header) for r in rows]
    path.write_text("\n".join(lines) + "\n")
