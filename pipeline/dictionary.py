"""Dictionary Entries for Themes from the Aquifer Open Bible Dictionary (decision 219): Mission
Mutual's adaptation of the Tyndale Open Bible Dictionary, both CC BY-SA 4.0. Runs after `themes`.

A Theme gets the article whose title is its Nave's heading, or the part of the heading before a
bracket ("LEAVEN (YEAST)" is Leaven), letters only, ignoring case. Never a part after a comma
("BUSH, BURNING" is not Bush), and never the bracket ("RECREATION (REST)" is not Rest). A title
that several articles share matches none of them. Every match and every skip is listed in
`theme_articles.tsv`, so the owner can read them.

The article's HTML becomes plain text in paragraphs, as Easton's text is (PRD 7.2): its title
heading is dropped, other headings, list items and table rows become paragraphs of their own,
and a Bible reference or a link to another article keeps only its words ("See Writing.").
"""

import json
import re
from collections import defaultdict
from html.parser import HTMLParser

from pipeline.common import norm
from pipeline.download import AOBD_FILES

NAMES = [f"aobd-{n:03d}" for n in range(1, AOBD_FILES + 1)]
SOURCE = "Aquifer Open Bible Dictionary"
BLOCKS = {"p", "h2", "h3", "h4", "li", "tr", "blockquote"}  # each starts a paragraph
SHORT = 300  # characters: an article this short is mostly a pointer ("See Family Life")


class Text(HTMLParser):
    """Paragraphs of an article's HTML. The paragraphs inside a list item or a table cell stay in
    the item's or the row's paragraph."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paragraphs, self.words, self.skip, self.inside = [], [], 0, 0

    def end_paragraph(self):
        if text := re.sub(r"\s+", " ", "".join(self.words)).strip(" |"):
            self.paragraphs.append(text)
        self.words = []

    def handle_starttag(self, tag, attrs):
        if tag == "h1":
            self.skip += 1
        elif tag in ("td", "th"):
            self.inside += 1
            if self.words:
                self.words.append(" | ")
        elif tag == "p" and self.inside:
            self.words.append(" ")
        elif tag in BLOCKS:
            self.end_paragraph()
            if tag == "li":
                self.inside += 1
                self.words.append("• ")
        elif tag == "br":
            self.words.append(" ")

    def handle_endtag(self, tag):
        if tag == "h1":
            self.skip -= 1
        elif tag in ("td", "th"):
            self.inside -= 1
        elif tag == "p" and self.inside:
            self.words.append(" ")
        elif tag in BLOCKS:
            if tag == "li":
                self.inside -= 1
            self.end_paragraph()

    def handle_data(self, data):
        if not self.skip:
            self.words.append(data.replace("\xa0", " "))


def plain_text(html):
    parser = Text()
    parser.feed(html)
    parser.close()
    parser.end_paragraph()
    return "\n\n".join(parser.paragraphs)


def articles(b):
    """Normalised title -> every article with that title, across the 26 files."""
    out = defaultdict(list)
    for name in NAMES:
        for a in json.loads(b.source(name).read_text(encoding="utf-8")):
            out[norm(a["title"])].append(a)
    return out


def load(b):
    by_title = articles(b)
    b.new_report("theme_articles", "theme", "heading", "match", "article_id", "title", "note")
    for e in b.entities.values():
        if e["type"] != "theme":
            continue
        heading = e["name"]
        first = re.sub(r"\)$", "", heading).partition(" (")[0]
        for match, form in (("heading", heading), ("before the bracket", first)):
            if found := by_title.get(norm(form)):
                break
        else:
            continue
        row = {"theme": e["id"], "heading": heading, "match": match}
        if len(found) > 1:
            ids = ", ".join(a["content_id"] for a in found)
            b.report("theme_articles", **row, article_id=ids, title=found[0]["title"],
                     note="several articles have this title: none is used")  # fmt: skip
            continue
        article = found[0]
        text = plain_text(article["content"])
        if not text:
            continue
        e["dictionary_entry"] = {"text": text, "source": SOURCE, "licence": b.licence(NAMES[0])}
        note = "short: mostly a pointer to another article" if len(text) < SHORT else ""
        b.report("theme_articles", **row, article_id=article["content_id"],
                 title=article["title"], note=note)  # fmt: skip
