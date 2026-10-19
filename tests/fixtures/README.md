# Test fixtures

Small slices of the real sources, cut by `cut.py` from a full download. Each slice keeps the licence of its source. The MIT licence of the code does not apply to them.

| File | Source | Licence |
|---|---|---|
| `sources/bsb.txt` | Berean Standard Bible, bereanbible.com/bsb.txt | CC0 1.0 (public domain) |
| `sources/books.json`, `sources/verses.json`, `sources/people.json`, `sources/places.json`, `sources/events.json`, `sources/peopleGroups.json` | Theographic Bible Metadata, github.com/robertrouse/theographic-bible-metadata | CC BY-SA 4.0 |
| `sources/cross-references.zip` | OpenBible.info cross-references, a.openbible.info/data/cross-references.zip | CC BY 4.0 |

Chapters: Genesis 11, 16, 25, 26, and 36; Matthew 17:20 to 22; 3 John 1.

Changes from the sources:

- KJV text is removed from `verses.json` (decision 42).
- `cross-references.zip` keeps the rows with an end in a kept verse (or at `3John.1.15`) whose other ends are outside Genesis, Matthew, and 3 John. `verses.json` also holds the Theographic records of those other ends, with only `osisRef` and `verseID`.
- `cross-references.zip` has two synthetic rows: `Matt.17.20` to `3John.1.15` (3 Votes), to test the remap to `3John.1.14`, and `Gen.11.1` to `Gen.11.33` (1 Vote), to test a cross-reference with no Verse Key.
- `bsb.txt` has one synthetic line, 3 John 1:15, to test a BSB verse with no Theographic key.
- The entity files keep only records that a kept verse mentions, and each record's `verses` keeps only the kept verses.
- Abraham (`abraham_58`) has one synthetic verse link, `recFixtureNoVerse`, to test a mention with no Verse Key.
- Demetrius (`demetrius_1007`) has no `dictText`, but keeps `dictionaryText`, to test that no Dictionary Entry comes from `dictionaryText`.
- The Tribe of Judah has one synthetic verse link, to Genesis 36:1, because no People Group has a real verse in the kept chapters.

Rules for later fixtures are in `docs/licences.md`, section 5. In short: the TIPNR fixture is synthetic, and OpenStreetMap records use made-up coordinates.
