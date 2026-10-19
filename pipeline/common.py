"""Shared state and helpers for the build steps."""

import json
from pathlib import Path

from pipeline.download import SOURCES, file_name

SIZE_LIMIT = 500 * 1000  # bytes, PRD 8.2


class Build:
    """State passed through the steps. Each step reads what earlier steps set and adds its own
    attributes (for example `chapters`, `entities`). Only `export` writes data files."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.out = Path(cfg["out"])
        self.used = set()  # source names read by this build, for index.json and credits
        self.reports = {}  # report name -> (header, rows); every declared report is written

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


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=1) + "\n")


def write_tsv(path, header, rows):
    lines = ["\t".join(header)] + ["\t".join(str(r[h]) for h in header) for r in rows]
    path.write_text("\n".join(lines) + "\n")
