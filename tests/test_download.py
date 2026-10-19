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
