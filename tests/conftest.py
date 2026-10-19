import json
import subprocess
import sys
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "sources"
CURATED = FIXTURES.parent / "curated"  # fixture copies of the curated tables, with test rows
REAL_CURATED = Path(__file__).parent.parent / "pipeline" / "curated"
VERSION = "test1"


def run_build(out, sources=FIXTURES, books=("Gen", "Matt", "3John"), curated=CURATED):
    """Run the build command, the one test seam. Returns the output folder."""
    config = out.parent / f"{out.name}.toml"
    config.write_text(
        f"books = {json.dumps(list(books))}\n"
        f'sources = "{sources}"\n'
        f'curated = "{curated}"\n'
        f'out = "{out}"\n'
        'build_date = "2026-10-19"\n'
        f'data_version = "{VERSION}"\n'
    )
    subprocess.run([sys.executable, "-m", "pipeline.build", config], check=True)
    return out


@pytest.fixture(scope="session")
def export(tmp_path_factory):
    return run_build(tmp_path_factory.mktemp("build") / "out")


def read_json(path):
    return json.loads(path.read_text())


def read_tsv(path):
    header, *rows = path.read_text().splitlines()
    return [dict(zip(header.split("\t"), r.split("\t"))) for r in rows]


def nodes_and_edges(obj):
    """Every dict in the export that is a node (has a `key` or `id`) or an edge (has `edge`).
    An Entity Neighbour is not one: it points at a node, and each of its `edges` is checked."""
    if isinstance(obj, dict):
        if {"key", "id", "edge"} & obj.keys() and "edges" not in obj:
            yield obj
        for v in obj.values():
            yield from nodes_and_edges(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from nodes_and_edges(v)
