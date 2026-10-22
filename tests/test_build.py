import gzip
import json
import subprocess

import pytest
from conftest import VERSION, compact_json, nodes_and_edges, read_json, read_tsv, run_build


def chapter(export, book, ch):
    return read_json(export / "data" / VERSION / "chapter" / book / f"{ch}.json")


def test_index_holds_books_counts_date_version_and_licences(export):
    index = read_json(export / "data" / "index.json")
    assert index["build_date"] == "2026-10-19"
    assert index["data_version"] == VERSION
    assert index["licence"] == "CC BY-SA 4.0"
    assert index["sources"]["bsb"] == "CC0 1.0"
    assert [b["osis"] for b in index["books"]] == ["Gen", "Matt", "John", "3John"]
    gen = index["books"][0]
    assert (gen["name"], gen["chapters"], gen["verses"]) == ("Genesis", 5, 160)
    assert index["counts"] == {"chapters": 11, "verses": 234}


def test_chapter_file_holds_each_verse_with_key_label_and_text(export):
    verses = chapter(export, "Gen", 16)["verses"]
    assert len(verses) == 16
    first = verses[0]
    assert (first["key"], first["label"], first["chapter"], first["verse"]) == (
        "01016001",
        "Gen.16.1",
        16,
        1,
    )
    assert first["text_bsb"].startswith("Now Abram’s wife Sarai had borne him no children")


def test_every_data_file_except_index_is_under_the_data_version(export):
    files = [p.relative_to(export / "data") for p in (export / "data").rglob("*.json")]
    assert all(p.parts[0] == VERSION for p in files if p.name != "index.json")


def test_verse_with_no_bsb_text_is_kept_and_marked(export):
    v21 = next(v for v in chapter(export, "Matt", 17)["verses"] if v["verse"] == 21)
    assert v21["no_bsb_text"] is True
    assert v21["text_bsb"] is None


def test_the_fixture_spans_both_testaments(export):
    # Fixture row: Gen.16.11 to Matt.1.21 (8 votes); both ends are in the build
    matt = next(v for v in chapter(export, "Matt", 1)["verses"] if v["verse"] == 21)
    assert "01016011" in [n["id"] for n in matt["cross_references"]]
    egypt = read_json(export / "data" / VERSION / "entity" / "place" / "egypt_362.json")
    assert {v["key"][:2] for v in egypt["verses"]} >= {"01", "40"}  # Genesis and Matthew
    judah = read_json(export / "data" / VERSION / "entity" / "group" / "tribe_of_judah.json")
    assert len([n for n in judah["neighbours"] if n["type"] == "person"]) > 100  # a long list


def test_bsb_verse_with_no_theographic_key_is_reported(export):
    rows = read_tsv(export / "reports" / "verse_mismatches.tsv")
    assert {
        "verse": "3John.1.15",
        "cause": "BSB verse with no Theographic verse key (dropped)",
        "count": "1",
    } in rows
    assert all(v["verse"] <= 14 for v in chapter(export, "3John", 1)["verses"])


def test_every_node_and_edge_has_source_and_licence(export):
    for path in (export / "data").rglob("*.json"):
        if path.name == "search-index.json":
            continue  # labels only; each node's source and licence are in its entity file
        for item in nodes_and_edges(read_json(path)):
            assert item.get("source") and item.get("licence"), (path.name, item)


def test_every_file_is_under_500_kb_gzipped_and_25_mib_raw_and_reported(export):
    # Decision 163: the limit is on the bytes a reader downloads, gzipped at level 9.
    rows = {r["path"]: r for r in read_tsv(export / "reports" / "files.tsv")}
    files = list((export / "data").rglob("*.json"))
    assert len(rows) == len(files)
    for p in files:
        row = rows[p.relative_to(export).as_posix()]
        gzipped = len(gzip.compress(p.read_bytes(), 9))
        assert (row["bytes"], row["gzipped_bytes"]) == (str(p.stat().st_size), str(gzipped))
        assert gzipped < 500 * 1000 and p.stat().st_size < 25 * 1024 * 1024


def test_a_file_over_the_limit_raw_but_under_it_gzipped_is_not_trimmed(export, tmp_path):
    # Decision 163: a limit above every file's gzipped size trims nothing, though the Gen 25
    # chapter file (about 77 KB raw, 6 KB gzipped) is far over it raw.
    rows = {r["path"]: r for r in read_tsv(export / "reports" / "files.tsv")}
    limit = max(int(r["gzipped_bytes"]) for r in rows.values()) + 1
    assert int(rows[f"data/{VERSION}/chapter/Gen/25.json"]["bytes"]) > limit
    out = run_build(tmp_path / "out", size_limit=limit)
    assert read_tsv(out / "reports" / "split_or_trimmed.tsv") == []
    assert chapter(out, "Gen", 25) == chapter(export, "Gen", 25)


def test_the_total_file_count_is_reported(export):
    # Story 76: the owner watches the 20,000 file limit before M6.
    files = list((export / "data").rglob("*.json"))
    assert read_tsv(export / "reports" / "file_count.tsv") == [
        {"files": str(len(files)), "over_limit": "0"}
    ]


def test_files_trimmed_under_the_limit_let_the_build_succeed(
    untrimmed_export, trimmed_export, trim_limit
):
    # Story 74: Gen 25's chapter file and sidecar are over the limit before trimming, and
    # trimmed under it; nothing is left over, so the build (run with check=True) passed.
    gen25 = [f"data/{VERSION}/chapter/Gen/25.json", f"data/{VERSION}/chapter/Gen/25.ring2.json"]
    before = {
        r["path"]: int(r["gzipped_bytes"])
        for r in read_tsv(untrimmed_export / "reports" / "files.tsv")
    }
    assert all(before[path] >= trim_limit for path in gen25)
    rows = read_tsv(trimmed_export / "reports" / "split_or_trimmed.tsv")
    assert sorted((r["path"], r["action"]) for r in rows) == [(p, "trimmed") for p in gen25]
    assert read_tsv(trimmed_export / "reports" / "file_count.tsv")[0]["over_limit"] == "0"


def test_a_file_still_over_the_limit_is_reported_and_fails_the_build(tmp_path, capfd):
    # Story 74 and decision 73: the limit never fails silently. At 5 KB gzipped, Abraham's entity
    # file (about 8 KB gzipped) and the search index (about 10 KB) are over, and only
    # cross-references trim: the Gen 25 chapter file (about 7 KB) is trimmed under it.
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", size_limit=5000)
    out = tmp_path / "out"
    trimmed = {r["path"]: r for r in read_tsv(out / "reports" / "split_or_trimmed.tsv")}
    over = [r["path"] for r in read_tsv(out / "reports" / "files.tsv") if r["over_limit"] == "yes"]
    assert f"data/{VERSION}/entity/person/abraham_58.json" in over
    assert f"data/{VERSION}/search-index.json" in over
    for path in over:
        assert trimmed[path]["action"].startswith("not trimmed"), path
    gen25 = f"data/{VERSION}/chapter/Gen/25.json"
    assert trimmed[gen25]["action"] == "trimmed" and gen25 not in over
    assert len(gzip.compress((out / gen25).read_bytes(), 9)) < 5000
    assert "over the size limit" in capfd.readouterr().err


def test_two_builds_are_byte_identical(export, tmp_path):
    again = run_build(tmp_path / "out")
    first = {p.relative_to(export): p.read_bytes() for p in export.rglob("*") if p.is_file()}
    second = {p.relative_to(again): p.read_bytes() for p in again.rglob("*") if p.is_file()}
    assert first == second


def test_export_files_are_compact_json_with_sorted_keys_and_utf8_text(export):
    # Decision 168: no indentation or spaces after separators; text such as "Abram’s" unescaped.
    for path in (export / "data").rglob("*.json"):
        text = path.read_text()
        assert text == compact_json(json.loads(text)), path.name
