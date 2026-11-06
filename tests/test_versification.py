"""Versification (decision 216, #126): each source's references move into KJV numbering by TVTMS.
The fixture TVTMS file is synthetic, in TVTMS's format (tests/fixtures/README.md)."""

import os
import subprocess
import sys
from pathlib import Path

from conftest import FIXTURES, read_tsv

ROOT = Path(__file__).parent.parent
TVTMS = FIXTURES / (
    "TVTMS - Translators Versification Traditions with Methodology for Standardisation for "
    "Eng+Heb+Lat+Grk+Others - STEPBible.org CC BY.txt"
)


def to_kjv(scheme, *refs):
    """The map command: each ref in KJV numbering."""
    cmd = [sys.executable, "-m", "pipeline.versification", str(TVTMS), scheme, *refs]
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    out = subprocess.run(cmd, check=True, env=env, capture_output=True, text=True).stdout
    return dict(line.split("\t") for line in out.splitlines())


def test_a_hebrew_psalm_title_is_kjv_verse_1_and_the_verses_after_it_move_back_one():
    assert to_kjv("hebrew", "Ps.3.1", "Ps.3.2", "Ps.3.3", "Ps.3.9") == {
        "Ps.3.1": "Ps.3.1",  # the title
        "Ps.3.2": "Ps.3.1",
        "Ps.3.3": "Ps.3.2",
        "Ps.3.9": "Ps.3.8",
    }


def test_a_psalm_title_written_as_verse_0_is_verse_1():
    assert to_kjv("kjv", "Ps.3.0", "Ps.3.1") == {"Ps.3.0": "Ps.3.1", "Ps.3.1": "Ps.3.1"}


def test_hebrew_joel_3_and_4_cross_the_chapter_boundary_into_kjv_joel_2_and_3():
    assert to_kjv("hebrew", "Joel.3.1", "Joel.3.5", "Joel.4.1", "Joel.4.21") == {
        "Joel.3.1": "Joel.2.28",
        "Joel.3.5": "Joel.2.32",
        "Joel.4.1": "Joel.3.1",
        "Joel.4.21": "Joel.3.21",
    }


def test_esv_3_john_1_15_is_kjv_3_john_1_14_but_not_in_the_niv():
    assert to_kjv("esv", "3John.1.15", "3John.1.14") == {
        "3John.1.15": "3John.1.14",
        "3John.1.14": "3John.1.14",
    }
    assert to_kjv("niv", "3John.1.15") == {"3John.1.15": "3John.1.15"}


def test_philippians_1_16_and_17_swap_and_rows_tvtms_does_not_mark_stay():
    assert to_kjv("niv", "Phil.1.16", "Phil.1.17", "Rev.12.17") == {
        "Phil.1.16": "Phil.1.17",
        "Phil.1.17": "Phil.1.16",
        "Rev.12.17": "Rev.12.17",  # ESV's longer 12:17 is left as it is, as TVTMS advises
    }


def test_rows_that_are_commented_out_or_not_whole_verses_move_nothing():
    # "#OneToOne" rows are not data; "Rev.12:18-13:1" spans a chapter, so it is not one verse.
    assert to_kjv("hebrew", "Joel.9.1", "Rev.12.18") == {
        "Joel.9.1": "Joel.9.1",
        "Rev.12.18": "Rev.12.18",
    }


def test_the_build_reports_every_reference_it_moves_by_source(export):
    rows = read_tsv(export / "reports" / "versification_moves.tsv")
    moved = {(r["source"], r["ref"]): r["kjv"] for r in rows}
    # Fixture rows: OpenBible's synthetic Matt.17.20 to 3John.1.15, and TIPNR's Reu at Psa.3.0.
    assert moved == {
        ("crossrefs", "3John.1.15"): "3John.1.14",
        ("tipnr", "Ps.3.0"): "Ps.3.1",
    }
