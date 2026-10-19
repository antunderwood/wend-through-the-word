import hashlib
import json
import subprocess
import sys


def test_supplied_file_is_recorded_with_its_checksum(tmp_path):
    src = tmp_path / "bsb.txt"
    src.write_text("Genesis 1:1\tIn the beginning God created the heavens and the earth.\n")
    dest = tmp_path / "sources"

    subprocess.run(
        [sys.executable, "-m", "pipeline.download", "--dest", dest, "--supply", "bsb", src],
        check=True,
    )

    entry = json.loads((dest / "manifest.json").read_text())["bsb"]
    assert entry["sha256"] == hashlib.sha256(src.read_bytes()).hexdigest()
    assert entry["url"] == "https://bereanbible.com/bsb.txt"
    assert entry["how"] == "supplied by owner"
    assert (dest / "bsb.txt").read_bytes() == src.read_bytes()


def test_lookup_sources_are_recorded_with_their_licence_and_file_name(tmp_path):
    expected = {  # name: (file, licence)
        "pleiades-locations": ("pleiades-locations-latest.csv.gz", "CC BY 3.0"),
        "wikidata-coords": ("wikidata-coords.json", "CC0 1.0"),
        "geonames-IL": ("IL.zip", "CC BY 4.0"),
    }
    src, dest = tmp_path / "any", tmp_path / "sources"
    src.write_bytes(b"lookup data")
    dest.mkdir()
    (dest / "modern.jsonl").write_text("")  # the Wikidata query is built from geo-modern
    for name in expected:
        cmd = [sys.executable, "-m", "pipeline.download", "--dest", dest, "--supply", name, src]
        subprocess.run(cmd, check=True)

    manifest = json.loads((dest / "manifest.json").read_text())
    assert {n: (manifest[n]["file"], manifest[n]["licence"]) for n in expected} == expected
    assert all((dest / file).exists() for file, _ in expected.values())


def test_the_wikidata_query_is_saved_and_recorded_so_the_file_can_be_fetched_again(tmp_path):
    # PRD 9 rule 3. The query is built from the Wikidata items that geo-modern cites.
    dest = tmp_path / "sources"
    dest.mkdir()
    records = [
        {"id": "m1", "coordinates_source": {"type": "wikidata", "id": "Q2"}},
        {"id": "m2", "secondary_sources": [{"type": "wikidata", "id": "Q1"}]},
    ]
    (dest / "modern.jsonl").write_text("".join(json.dumps(r) + "\n" for r in records))
    src = tmp_path / "result.json"
    src.write_text('{"results": {"bindings": []}}')
    cmd = [sys.executable, "-m", "pipeline.download", "--dest", dest]
    subprocess.run([*cmd, "--supply", "wikidata-coords", src], check=True)

    entry = json.loads((dest / "manifest.json").read_text())["wikidata-coords"]
    query = (dest / entry["query"]).read_bytes()
    assert entry["query"] == "wikidata-query.sparql"
    assert entry["query_sha256"] == hashlib.sha256(query).hexdigest()
    assert b"VALUES ?item { wd:Q1 wd:Q2 }" in query
