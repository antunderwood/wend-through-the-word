"""Published Entity IDs (decision 215, #124): the registry, redirects, and the release check."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from conftest import CURATED, IDS, VERSION, read_json, read_tsv, run_build

ROOT = Path(__file__).parent.parent


def read_registry(path):
    return {r["id"]: r["first_version"] for r in read_tsv(path)}


def write_registry(path, known):
    lines = ["id\tfirst_version"] + [f"{i}\t{v}" for i, v in sorted(known.items())]
    path.write_text("\n".join(lines) + "\n")


def record(out, path):
    """The record command as the owner runs it. Returns its output."""
    cmd = [sys.executable, "-m", "pipeline.ids", "record", str(out), "--ids", str(path)]
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    return subprocess.run(cmd, check=True, env=env, capture_output=True, text=True).stdout


def redirects(out):
    return read_json(out / "data" / VERSION / "redirects.json")


def test_the_fixture_ships_every_published_id_or_a_redirect_for_it(export):
    assert read_tsv(export / "reports" / "ids_new.tsv") == []
    assert read_tsv(export / "reports" / "ids_missing.tsv") == []
    assert read_tsv(export / "reports" / "id_redirects_invalid.tsv") == []


def test_reviewed_redirects_ship_with_their_provenance(export):
    # Fixture rows: a renamed Theme points to its new ID; a deleted record points nowhere.
    assert redirects(export) == {
        "source": "Curated",
        "licence": "CC BY-SA 4.0",
        "redirects": {
            "theme:sold_birthright": "theme:birthright",
            "person:fixture_removed_9999": None,
        },
    }


def registry_with(tmp_path, **rows):
    """A copy of the fixture registry with `rows` (ID -> first version, None to drop it)."""
    known = read_registry(IDS) | rows
    path = tmp_path / "ids.tsv"
    write_registry(path, {k: v for k, v in known.items() if v})
    return path


def tables_with(tmp_path, *rows):
    """A copy of the fixture curated tables whose id_redirects.csv holds only `rows`."""
    folder = tmp_path / "curated"
    shutil.copytree(CURATED, folder)
    lines = ["id,to,reason,reviewed,request", *rows]
    (folder / "id_redirects.csv").write_text("\n".join(lines) + "\n")
    return folder


def test_a_published_id_that_no_longer_ships_fails_the_build_until_a_reviewed_row_covers_it(
    tmp_path, capfd
):
    ids = registry_with(tmp_path, **{"person:gone_1": "test0"})
    curated = tables_with(
        tmp_path,
        "theme:sold_birthright,theme:birthright,renamed,,",  # not reviewed: does not ship
        "person:fixture_removed_9999,,deleted,yes,",
    )
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", ids=ids, curated=curated)
    out = tmp_path / "out"
    assert read_tsv(out / "reports" / "ids_missing.tsv") == [
        {"id": "person:gone_1", "first_version": "test0"},
        {"id": "theme:sold_birthright", "first_version": "test0"},
    ]
    assert redirects(out)["redirects"] == {"person:fixture_removed_9999": None}
    assert "2 published IDs no longer ship" in capfd.readouterr().err

    curated = tables_with(
        tmp_path / "fixed",
        "theme:sold_birthright,theme:birthright,renamed,yes,",
        "person:fixture_removed_9999,,deleted,yes,",
        "person:gone_1,,deleted upstream,yes,",
    )
    run_build(tmp_path / "fixed" / "out", ids=ids, curated=curated)  # check=True: it passes


def test_a_redirect_from_an_id_that_still_ships_or_to_one_that_does_not_fails_the_build(
    tmp_path, capfd
):
    curated = tables_with(
        tmp_path,
        "theme:sold_birthright,theme:nothing_here,renamed,yes,",
        "person:fixture_removed_9999,,deleted,yes,",
        "person:esau_1216,person:israel_682,wrong,yes,",
    )
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=curated)
    out = tmp_path / "out"
    assert read_tsv(out / "reports" / "id_redirects_invalid.tsv") == [
        {"id": "person:esau_1216", "to": "person:israel_682", "cause": "the ID still ships"},
        {
            "id": "theme:sold_birthright",
            "to": "theme:nothing_here",
            "cause": "the target does not ship",
        },
    ]
    err = capfd.readouterr().err
    assert "id_redirects.csv: person:esau_1216: the ID still ships" in err


def test_a_new_id_is_reported_and_does_not_fail_the_build(tmp_path):
    out = run_build(tmp_path / "out", ids=registry_with(tmp_path, **{"person:esau_1216": None}))
    assert read_tsv(out / "reports" / "ids_new.tsv") == [
        {"id": "person:esau_1216", "type": "person"}
    ]


def test_a_build_with_no_registry_checks_nothing(tmp_path):
    out = run_build(tmp_path / "out", ids=None)
    assert not (out / "reports" / "ids_new.tsv").exists()
    assert redirects(out)["redirects"] == {}


def test_record_adds_new_ids_with_the_data_version_and_keeps_the_first_version(export, tmp_path):
    path = registry_with(tmp_path, **{"person:esau_1216": None, "person:israel_682": "v0"})
    assert record(export, path) == f"1 IDs added to {path}\n"
    known = read_registry(path)
    assert known["person:esau_1216"] == VERSION
    assert known["person:israel_682"] == "v0"
    assert known.keys() == read_registry(IDS).keys()
    assert path.read_text().splitlines()[0] == "id\tfirst_version"
