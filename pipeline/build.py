"""Build the static export and the reports from local files only. Never touches the network.

Usage:
    python -m pipeline.build CONFIG.toml

Config keys: books (OSIS names), sources (folder), out (folder), build_date, data_version.
"""

import sys
import tomllib
from pathlib import Path

from pipeline import coordinates, crossrefs, entities, export, verses
from pipeline.common import Build

# Each step reads what earlier steps set on the Build. Add new steps here, before export.
STEPS = [
    verses.load,
    entities.load,
    coordinates.load,
    crossrefs.load,
    export.write,
]


def main(cfg):
    b = Build(cfg)
    for step in STEPS:
        step(b)


if __name__ == "__main__":
    main(tomllib.loads(Path(sys.argv[1]).read_text()))
