"""Dictionary Entries on Themes from the Aquifer Open Bible Dictionary (decision 219). The fixture
articles are cut from the real files (tests/fixtures/cut.py), with one synthetic second "Gold"."""

from conftest import read_json, read_tsv


def theme(export, name):
    return read_json(export / "data" / "test1" / "entity" / "theme" / f"{name}.json")


def articles(export):
    return {r["theme"]: r for r in read_tsv(export / "reports" / "theme_articles.tsv")}


def test_a_theme_gets_the_article_with_its_heading_as_title_labelled_with_its_source(export):
    entry = theme(export, "hypocrisy")["dictionary_entry"]
    assert entry["source"] == "Aquifer Open Bible Dictionary"
    assert entry["licence"] == "CC BY-SA 4.0"
    assert entry["text"].startswith("Hypocrisy is pretending to be something you are not")


def test_the_html_becomes_plain_paragraphs_without_the_title(export):
    text = theme(export, "hypocrisy")["dictionary_entry"]["text"]
    assert "<" not in text and "HYPOCRISY" not in text
    assert "\n\nOriginal Meaning\n\n" in text  # a heading is a paragraph of its own
    assert "\n\n• Being kind to others\n\n" in text  # a list item keeps its bullet
    assert "(Matthew 23:28)" in text  # a Bible reference keeps its words


def test_a_heading_matches_by_its_part_before_a_bracket_but_never_after_a_comma(export):
    assert articles(export)["theme:angel_a_spirit"]["match"] == "before the bracket"
    assert theme(export, "angel_holy_trinity")["dictionary_entry"]["text"]
    # "ACCUSATION, FALSE" is not Accusation, and "JESUS, THE CHRIST" is not Jesus.
    assert "theme:accusation_false" not in articles(export)


def test_a_title_several_articles_share_gives_no_entry_and_is_reported(export):
    assert "dictionary_entry" not in theme(export, "gold")
    assert articles(export)["theme:gold"]["article_id"] == "5506, synthetic-1"


def test_a_short_pointer_article_ships_and_is_flagged(export):
    assert theme(export, "house")["dictionary_entry"]["text"].endswith("See Homes and Dwellings.")
    assert articles(export)["theme:house"]["note"].startswith("short")


def test_the_dictionary_is_credited_with_tyndale_and_listed_as_shipped(export):
    credits = read_json(export / "data" / "test1" / "credits.json")["sources"]
    aobd = next(e for e in credits if e["name"] == "Aquifer Open Bible Dictionary")
    assert "Tyndale Open Bible Dictionary © 2023 Tyndale House Publishers" in aobd["credit"]
    assert len(aobd["files"]) == 26
    assert read_json(export / "data" / "index.json")["sources"]["aobd-001"] == "CC BY-SA 4.0"
