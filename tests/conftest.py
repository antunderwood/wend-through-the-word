import json
import subprocess
import sys
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "sources"
VERSION = "test1"


def run_build(out, sources=FIXTURES, books=("Gen", "Matt", "3John"), **extra):
    """Run the build command, the one test seam. Returns the output folder. `extra` holds more
    config keys with integer values, such as `size_limit`."""
    config = out.parent / f"{out.name}.toml"
    config.write_text(
        f"books = {json.dumps(list(books))}\n"
        f'sources = "{sources}"\n'
        f'out = "{out}"\n'
        'build_date = "2026-10-19"\n'
        f'data_version = "{VERSION}"\n' + "".join(f"{k} = {v}\n" for k, v in extra.items())
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
    Ring 2 entries are left out: the spec keeps them to an ID and a weight only, and the Ring 2
    file names their source and licence once at the top."""
    if isinstance(obj, dict):
        if {"key", "id", "edge"} & obj.keys() and obj.keys() != {"id", "weight"}:
            yield obj
        for v in obj.values():
            yield from nodes_and_edges(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from nodes_and_edges(v)
