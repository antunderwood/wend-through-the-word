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
    for name in expected:
        cmd = [sys.executable, "-m", "pipeline.download", "--dest", dest, "--supply", name, src]
        subprocess.run(cmd, check=True)

    manifest = json.loads((dest / "manifest.json").read_text())
    assert {n: (manifest[n]["file"], manifest[n]["licence"]) for n in expected} == expected
    assert all((dest / file).exists() for file, _ in expected.values())
