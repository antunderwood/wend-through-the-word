"""The data quality summary page (decision 166)."""

import html
import re
import shutil

import pytest
from conftest import read_tsv, run_build


def page(out):
    return (out / "reports" / "summary.html").read_text()


def sections(out):
    """The page's visible text, by report: report name -> its section's words, space joined."""
    text = {}
    for part in page(out).split("<section")[1:]:
        words = html.unescape(re.sub(r"<[^>]+>", " ", "<section" + part)).split()
        text[words[0].rstrip(":")] = " ".join(words)
    return text


@pytest.fixture(scope="module")
def compared(export, tmp_path_factory):
    """A build given a previous build's reports: one alias fewer, one Genesis verse mismatch
    fewer, and no dropped edges report."""
    tmp = tmp_path_factory.mktemp("compared")
    previous = shutil.copytree(export / "reports", tmp / "previous")
    for name, drop in (("aliases", -1), ("verse_mismatches", "Gen.16\t")):
        path = previous / f"{name}.tsv"
        lines = path.read_text().splitlines()
        lines.remove(lines[drop] if drop == -1 else next(x for x in lines if x.startswith(drop)))
        path.write_text("\n".join(lines) + "\n")
    (previous / "dropped_edges.tsv").unlink()
    return run_build(tmp / "out", previous_reports=f'"{previous}"')


def test_summary_counts_each_report_and_opens_from_disk(export):
    text = sections(export)
    tsvs = sorted((export / "reports").glob("*.tsv"))
    assert sorted(text) == [p.stem for p in tsvs]
    for path in tsvs:
        n = len(read_tsv(path))
        assert text[path.stem].startswith(f"{path.stem}: {n:,} row{'s' * (n != 1)} "), path
    assert text["no_coordinate"].startswith("no_coordinate: 6 rows")
    assert "place:canaan_272" in text["no_coordinate"]  # a sample row
    # Counts per book, from a Verse (Gen.16) or an Entity (each Place's first Verse).
    assert "Gen 5 Matt 1 3John 1 No book 1" in text["verse_mismatches"]
    assert "Gen 6" in text["no_coordinate"]
    # No scripts, styles, or images from elsewhere; every link is a file beside the page.
    assert not re.search(r"<script|<link|<img|src=|url\(", page(export))
    links = re.findall(r'href="([^"]*)"', page(export))
    assert links and all((export / "reports" / link).is_file() for link in links)
    assert not re.search("[–—]", page(export))
    assert not re.search(r"rows? \(", " ".join(text.values()))  # no previous build, no changes


def test_summary_shows_the_change_since_a_previous_build(export, compared):
    text = sections(compared)
    aliases = len(read_tsv(export / "reports" / "aliases.tsv"))
    assert text["aliases"].startswith(f"aliases: {aliases} rows (+1) ")
    assert text["no_coordinate"].startswith("no_coordinate: 6 rows (0) ")
    assert "Gen 5 +1 Matt 1 0" in text["verse_mismatches"]
    assert re.match(r"dropped_edges: \d+ rows \(new\) ", text["dropped_edges"])
    assert not re.search("[–—]", page(compared))
