import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest
from conftest import VERSION

ROOT = Path(__file__).parent.parent


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True)


@pytest.fixture
def repo(tmp_path, export):
    """A clean checkout with an origin, and a copy of the fixture export in its ignored out/."""
    origin, repo = tmp_path / "origin.git", tmp_path / "repo"
    git(tmp_path, "init", "-q", "--bare", origin)
    git(tmp_path, "init", "-q", "-b", "main", repo)
    (repo / ".gitignore").write_text("out/\n")
    git(repo, "add", ".")
    git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "first")
    git(repo, "remote", "add", "origin", origin)
    git(repo, "push", "-q", "origin", "main")
    shutil.copytree(export, repo / "out")
    # The fixture's curated tables hold rows that no longer match, to test that report; a release
    # needs none.
    (repo / "out" / "reports" / "curated_no_longer_matches.tsv").write_text(
        "table\tline\tids\tdetail\n"
    )
    return repo


def release(repo, *args):
    """The release command as the owner runs it, from the checkout, in dry-run mode."""
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    cmd = [sys.executable, "-m", "pipeline.release", *args, "--dry-run"]
    return subprocess.run(cmd, check=False, cwd=repo, env=env, capture_output=True, text=True)


def test_dry_run_zips_the_export_and_prints_the_release_without_making_it(repo):
    run = release(repo, "v1")
    assert run.returncode == 0, run.stderr
    with zipfile.ZipFile(repo / "out" / f"wend-data-{VERSION}.zip") as z:
        assert "data/index.json" in z.namelist()
        assert f"data/{VERSION}/search-index.json" in z.namelist()
    commit = git(repo, "rev-parse", "HEAD").stdout.strip()
    for line in (f"Data version: {VERSION}", "Build date: 2026-10-19", f"Commit: {commit}"):
        assert line in run.stdout
    assert "git push origin v1" in run.stdout
    assert f"gh release create v1 out/wend-data-{VERSION}.zip" in run.stdout
    assert git(repo, "tag").stdout == ""
    # Reports that do not stop a release are listed for the owner to read.
    assert re.search(r"Warning: reports/aliases\.tsv has \d+ rows", run.stdout)
    assert "files.tsv" not in run.stdout


def test_refuses_a_dirty_tree_or_a_tag_that_exists_here_or_on_origin(repo):
    (repo / "notes.txt").write_text("not committed\n")
    run = release(repo, "v1")
    assert run.returncode == 1
    assert "the working tree has uncommitted changes" in run.stderr
    (repo / "notes.txt").unlink()

    git(repo, "tag", "v1")
    assert "tag v1 already exists here" in release(repo, "v1").stderr
    git(repo, "push", "-q", "origin", "v1")
    git(repo, "tag", "-d", "v1")
    assert "tag v1 already exists on origin" in release(repo, "v1").stderr
    assert not (repo / "out" / f"wend-data-{VERSION}.zip").exists()


def test_refuses_a_file_over_500_kb_gzipped_or_25_mib_raw_but_not_one_over_500_kb_raw(repo):
    # Decision 163: random bytes barely compress; repeated text compresses to almost nothing.
    data = repo / "out" / "data" / VERSION
    (data / "random.json").write_bytes(os.urandom(600 * 1000))
    (data / "huge.json").write_bytes(b"{}" * (13 * 1024 * 1024))
    (data / "text.json").write_bytes(b'"Abraham"' * (100 * 1000))
    run = release(repo, "v1")
    assert run.returncode == 1
    assert re.search(rf"out/data/{VERSION}/random\.json: 600000 bytes, \d+ gzipped", run.stderr)
    assert f"out/data/{VERSION}/huge.json: 27262976 bytes" in run.stderr
    assert "text.json" not in run.stderr


def test_refuses_an_export_that_breaks_the_file_limit(repo):
    extra = repo / "out" / "data" / VERSION / "extra"
    extra.mkdir()
    for i in range(20_000):
        (extra / f"{i}.json").touch()
    run = release(repo, "v1")
    assert run.returncode == 1
    assert "out/data holds 20641 files, the limit is 20000" in run.stderr


def test_refuses_an_untrimmed_file_or_a_curated_row_that_no_longer_matches(repo):
    reports = repo / "out" / "reports"
    with open(reports / "split_or_trimmed.tsv", "a") as f:
        f.write(f"data/{VERSION}/big.json\tnot trimmed: over the limit\t0\t\n")
    with open(reports / "curated_no_longer_matches.tsv", "a") as f:
        f.write("corrections\t5\tperson:nobody_0 gender\tnot in Theographic\n")
    run = release(repo, "v1")
    assert run.returncode == 1
    assert f"reports/split_or_trimmed.tsv: data/{VERSION}/big.json not trimmed" in run.stderr
    assert "reports/curated_no_longer_matches.tsv: 1 curated rows no longer match" in run.stderr


def test_the_deploy_workflow_pins_every_action_to_a_commit():
    """Decision 160: a moved tag cannot change what runs with the Cloudflare token."""
    workflow = (ROOT / ".github" / "workflows" / "deploy.yml").read_text()
    uses = re.findall(r"uses: (.*)", workflow)
    assert uses
    assert [u for u in uses if not re.fullmatch(r"[\w./-]+@[0-9a-f]{40} # v[\d.]+", u)] == []
