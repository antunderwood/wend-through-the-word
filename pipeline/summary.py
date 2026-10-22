"""The data quality summary page (decision 166): `reports/summary.html`, one section per report
with its row count, its rows per book, its first rows, and a link to its TSV. Given the config
key `previous_reports` (a previous build's reports folder), each count shows its change. Plain
HTML with no scripts or network, so it opens from disk."""

import re
from collections import Counter
from html import escape

SAMPLE = 10  # first rows shown per report
STYLE = (
    "body{font:14px/1.4 sans-serif;margin:2em;color:#161026}"
    "table{border-collapse:collapse;margin:.5em 0}"
    "td,th{border:1px solid #cdcbd8;padding:2px 6px;text-align:left;vertical-align:top}"
)


def read(b, reports):
    """Report name -> (header, rows, rows per book) for each TSV in `reports`. A row's book is
    that of its first cell naming a Verse (`Gen.16`) or an Entity (the book of its first Verse);
    None if it names neither."""
    osis = {x["order"]: name for name, x in b.books.items()}

    def book(row):
        for token in (t for cell in row for t in re.split(r"[ ,]+", cell)):
            if keys := b.verse_sets.get(token):
                return osis[int(min(keys)[:2])]
            if token.split(".")[0] in b.books:
                return token.split(".")[0]
        return None

    out = {}
    for path in sorted(reports.glob("*.tsv")):
        header, *rows = [line.split("\t") for line in path.read_text().splitlines()]
        out[path.stem] = (header, rows, Counter(map(book, rows)))
    return out


def write(b, reports, previous):
    """Write the page from the TSVs in `reports`. `previous` is `read` of a previous build's
    reports, or None."""

    def change(name, count, book=None):
        if previous is None:
            return ""
        if name not in previous:
            return "new"
        d = count - (len(previous[name][1]) if book is None else previous[name][2][book])
        return f"{d:+,}" if d else "0"

    compared = ""
    if previous is not None:
        compared = f" Changes are since {escape(b.cfg['previous_reports'])}."
    head = (
        "<!doctype html><meta charset=utf-8><title>Data quality summary</title>"
        f"<style>{STYLE}</style><h1>Data quality summary</h1>"
        f"<p>Build {escape(b.cfg['build_date'])}, data version {escape(b.cfg['data_version'])}."
        " Rows with a Verse or Entity are counted under its book (an Entity's first Verse)."
    )
    parts = [head + compared]
    order = {name: x["order"] for name, x in b.books.items()}
    for name, (header, rows, books) in read(b, reports).items():
        diff = change(name, len(rows))
        parts.append(
            f"<section><h2>{name}: {len(rows):,} row{'s' * (len(rows) != 1)}{f' ({diff})' if diff else ''}</h2>"
            f'<p><a href="{name}.tsv">{name}.tsv</a>'
        )
        if any(books):  # a Counter key of None means no book
            was = previous.get(name, ((), (), {}))[2] if previous else {}
            parts.append("<table><tr><th>Book<th>Rows" + ("<th>Change" if compared else ""))
            for book in sorted(set(books) | set(was), key=lambda k: order.get(k, 99)):
                diff = f"<td>{change(name, books[book], book)}" if compared else ""
                parts.append(f"<tr><td>{book or 'No book'}<td>{books[book]:,}{diff}")
            parts.append("</table>")
        if rows:
            parts.append(f"<p>First {min(len(rows), SAMPLE)} rows:<table><tr>")
            parts.append("".join(f"<th>{escape(h)}" for h in header))
            for row in rows[:SAMPLE]:
                parts.append("<tr>" + "".join(f"<td>{escape(c)}" for c in row))
            parts.append("</table>")
        parts.append("</section>")
    (reports / "summary.html").write_text("\n".join(parts) + "\n")
