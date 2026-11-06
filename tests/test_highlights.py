"""Referring terms (decision 221): the curated highlights.csv. The fixture table is in
tests/fixtures/curated; the reports it causes are tested in test_curated.py."""

import subprocess

import pytest
from conftest import CURATED as CURATED_FIXTURES
from conftest import chapter_verse, run_build
from test_curated import broken_tables


def test_a_reviewed_row_ships_on_its_verse_with_its_words_and_note(export):
    assert chapter_verse(export, "Gen.25.21")["highlights"] == [
        {
            "id": "person:rebekah_2401",
            "words": ["his wife", "she"],
            "source": "Curated",
            "licence": "CC BY-SA 4.0",
            "evidence": [{"verse_key": "01025021", "label": "Gen.25.21"}],
            "note": "Isaac's wife, Rebekah, named later in the verse.",
            "request": None,
        }
    ]
    assert chapter_verse(export, "Gen.25.26")["highlights"][0]["request"] == (
        "https://example.org/request"
    )


def test_unreviewed_and_stale_rows_do_not_ship(export):
    # Unreviewed (Gen.36.24), not linked (Gen.25.24); Isaac's row in Gen.25.21 does not match.
    assert "highlights" not in chapter_verse(export, "Gen.36.24")
    assert "highlights" not in chapter_verse(export, "Gen.25.24")
    ids = [h["id"] for h in chapter_verse(export, "Gen.25.21")["highlights"]]
    assert ids == ["person:rebekah_2401"]


def test_a_phrase_matches_only_whole_words(tmp_path):
    # "he" is in "she" and "heard", but not as a word of Gen.25.21.
    folder = broken_tables(tmp_path, "his wife;he,", "highlights.csv", "his wife;she,")
    out = run_build(tmp_path / "out", curated=folder)
    assert "highlights" not in chapter_verse(out, "Gen.25.21")


@pytest.mark.parametrize(
    "new, old, message",
    [
        ("Gen.99.1,person:rebekah", "Gen.25.21,person:rebekah", "Gen.99.1 is not a Verse Key"),
        ("_2401,,", "_2401,his wife;she,", "highlights.csv line 2: no words"),
    ],
)
def test_a_row_that_does_not_parse_fails_the_build(tmp_path, capfd, new, old, message):
    with pytest.raises(subprocess.CalledProcessError):
        run_build(tmp_path / "out", curated=broken_tables(tmp_path, new, "highlights.csv", old))
    assert message in capfd.readouterr().err


def test_the_fixture_table_has_the_real_columns():
    real = CURATED_FIXTURES.parent.parent.parent / "pipeline" / "curated" / "highlights.csv"
    fixture = CURATED_FIXTURES / "highlights.csv"
    assert real.read_text().splitlines()[0] == fixture.read_text().splitlines()[0]
