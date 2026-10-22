"""Release the local export (decisions 152, 153): zip out/data, push the tag, and create the GitHub
release with the zip attached. Publishing the release starts the deploy workflow.

Usage, from the repository root:
    python -m pipeline.release TAG [--out OUT] [--dry-run]

--dry-run makes the zip and prints the commands it would run, but pushes and creates nothing.
"""

import argparse
import csv
import json
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

from pipeline.common import file_sizes, over_limit

FILE_LIMIT = 20_000  # Workers static assets, Free plan (PRD 8.4); the stage adds a few pages


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def rows(report):
    with open(report) as f:
        return list(csv.DictReader(f, delimiter="\t"))


def problems(tag, out):
    """Why the export in `out` must not be released as `tag`; empty if it may be."""
    found = []
    if git("status", "--porcelain"):
        found.append("the working tree has uncommitted changes")
    if git("tag", "--list", tag):
        found.append(f"tag {tag} already exists here")
    if git("ls-remote", "--tags", "origin", f"refs/tags/{tag}"):
        found.append(f"tag {tag} already exists on origin")
    # The size rule is measured again on the files, so an export changed after its build is
    # judged too (decision 163).
    files = sorted(f for f in (out / "data").rglob("*") if f.is_file())
    for f, (raw, gz) in zip(files, file_sizes(files)):
        if over_limit(raw, gz):
            found.append(f"{f}: {raw} bytes, {gz} gzipped, over the size limit")
    for row in rows(out / "reports" / "split_or_trimmed.tsv"):
        if row["action"].startswith("not trimmed"):
            found.append(f"reports/split_or_trimmed.tsv: {row['path']} {row['action']}")
    if stale := rows(out / "reports" / "curated_no_longer_matches.tsv"):  # decision 77
        found.append(
            f"reports/curated_no_longer_matches.tsv: {len(stale)} curated rows no longer match"
        )
    if len(files) >= FILE_LIMIT:
        found.append(f"{out / 'data'} holds {len(files)} files, the limit is {FILE_LIMIT}")
    return found


def warnings(out):
    """The reports with rows that do not stop a release, for the owner to read. files.tsv and
    file_count.tsv list the export, so they are not reports of problems."""
    return [
        f"Warning: reports/{r.name} has {n} rows"
        for r in sorted((out / "reports").glob("*.tsv"))
        if r.name not in ("files.tsv", "file_count.tsv") and (n := len(rows(r)))
    ]


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m pipeline.release")
    p.add_argument("tag")
    p.add_argument("--out", default="out", type=Path)
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)

    if found := problems(a.tag, a.out):
        sys.exit("Refusing to release:\n" + "\n".join(f"- {f}" for f in found))
    print(*warnings(a.out), sep="\n")
    index = json.loads((a.out / "data" / "index.json").read_text())
    version = index["data_version"]
    archive = a.out / f"wend-data-{version}.zip"
    shutil.make_archive(archive.with_suffix(""), "zip", a.out, "data")
    notes = (
        f"Data version: {version}\n"
        f"Build date: {index['build_date']}\n"
        f"Commit: {git('rev-parse', 'HEAD').strip()}\n"
    )
    commands = [
        ["git", "tag", "-a", a.tag, "-m", f"Release {a.tag}"],
        ["git", "push", "origin", a.tag],
        ["gh", "release", "create", a.tag, str(archive), "--verify-tag", "--notes", notes],
    ]
    print(notes)
    for cmd in commands:
        print(shlex.join(cmd) if a.dry_run else f"Running: {shlex.join(cmd)}")
        if not a.dry_run:
            subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
