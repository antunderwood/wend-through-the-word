# Test fixtures

Small slices of the real sources, cut by `cut.py` from a full download. Each slice keeps the licence of its source. The MIT licence of the code does not apply to them.

| File | Source | Licence |
|---|---|---|
| `sources/bsb.txt` | Berean Standard Bible, bereanbible.com/bsb.txt | CC0 1.0 (public domain) |
| `sources/books.json`, `sources/verses.json`, `sources/people.json`, `sources/places.json`, `sources/events.json`, `sources/peopleGroups.json`, `sources/bible-places.geojson` | Theographic Bible Metadata, github.com/robertrouse/theographic-bible-metadata | CC BY-SA 4.0 |
| `sources/ancient.jsonl`, `sources/modern.jsonl` | OpenBible.info Bible Geocoding Data, github.com/openbibleinfo/Bible-Geocoding-Data (commit `7eb18a5`) | CC BY 4.0 |
| `sources/cross-references.zip` | OpenBible.info cross-references, a.openbible.info/data/cross-references.zip | CC BY 4.0 |
| `sources/pleiades-locations-latest.csv.gz` | Pleiades locations dump, atlantides.org/downloads/pleiades/dumps (downloaded 2026-10-19) | CC BY 3.0 |
| `sources/wikidata-coords.json` | Wikidata SPARQL result, query.wikidata.org (query in `pipeline/download.py`, run 2026-10-19) | CC0 1.0 |
| `sources/??.zip`, `sources/no-country.zip` | GeoNames dump files, download.geonames.org/export/dump (downloaded 2026-10-19) | CC BY 4.0 |
| `sources/NavesTopicalDictionary.csv` | Nave's Topical Bible, BibleData, github.com/BradyStephenson/bible-data (commit `720a8da`) | CC BY 4.0 |
| `sources/TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt` | Synthetic, written by hand in the TIPNR format (github.com/STEPBible/STEPBible-Data). Holds no real TIPNR rows | Our own test data, MIT |

Chapters: Genesis 11, 16, 25, 26, and 36; Matthew 1, 2, 16:13 to 20, and 17:20 to 22; John 1:1; 3 John 1. Matthew 16:13 to 20 (Peter's confession) and John 1:1 are for the tour (decision 174). Matthew 1 and 2 are cut by the same rules from the same files, so they keep the licences above (BSB CC0 1.0, Theographic CC BY-SA 4.0, OpenBible.info CC BY 4.0, Nave's CC BY 4.0). They give Cross-references between books (Gen 16:11 and Matt 1:21), People and Places in both Testaments (Abraham, Isaac, Jacob; Egypt), and a list of more than 100 rows (the People of the Tribe of Judah).

Changes from the sources:

- KJV text is removed from `verses.json` (decision 42).
- `books.json` keeps all 66 books, so the search index names them all (decision 102).
- `cross-references.zip` keeps the rows with an end in a kept verse (or at `3John.1.15`) whose other ends are outside Genesis, Matthew, John, and 3 John. `verses.json` also holds the Theographic records of those other ends, with only `osisRef` and `verseID`.
- `cross-references.zip` has two synthetic rows: `Matt.17.20` to `3John.1.15` (3 Votes), to test the remap to `3John.1.14`, and `Gen.11.1` to `Gen.11.33` (1 Vote), to test a cross-reference with no Verse Key.
- `bsb.txt` has one synthetic line, 3 John 1:15, to test a BSB verse with no Theographic key.
- The entity files keep the records that a kept verse mentions, and each record's `verses` keeps only the kept verses, plus its links to the cross-reference ends kept in `verses.json` (outside the fixture books), so a whole-Bible Verse set holds more than the book range (decision 95). They also keep the records that those records link to through an edge field (`father`, `mother`, `children`, `siblings`, the two half sibling fields, `partners`, `birthPlace`, `deathPlace`, `memberOf`, `participants`, `locations`), with no verses, to test stubs outside the book range. Edge fields keep only links to kept records.
- Abraham (`abraham_58`) has one synthetic verse link, `recFixtureNoVerse`, to test a mention with no Verse Key, and one synthetic sibling link, `recFixtureNoRecord`, to test an edge whose other end does not exist.
- Jesus Christ (`jesus_905`) has one synthetic verse link, to 3 John 1:1, a letter's greeting, beside Gaius, to test that a greeting links nothing to him (decision 176).
- Demetrius (`demetrius_1007`) has no `dictText`, but keeps `dictionaryText`, to test that no Dictionary Entry comes from `dictionaryText`.
- `places.json` has one synthetic record, a second Sitnah (`sitnah_9102`), with links to Genesis 26:21 and 26:22. It shares Sitnah's only verse, as the two Valleys of Shaveh share Genesis 14:17, to test the same-name hint (decision 122).
- `people.json` has one synthetic record, a fourth Anah (`anah_9250`), daughter of Zibeon (`zibeon_3061`), with links to 1 Chronicles 1:39 and 1:40 only. She ships as a stub, and shares 1 Chronicles 1:40 with `anah_249`, to test the same-name hint of a stub, which uses her whole-Bible Verses (decision 122).
- The Tribe of Judah has one synthetic verse link, to Genesis 36:1, because no People Group has a real verse in the kept chapters.
- Theographic coordinates in `places.json` (`latitude`, `openBibleLat`, `recogitoLat`, and the longitudes) are made up: -11.111111 and -22.222222. They can carry OpenStreetMap points (decision 41), and a test checks they never reach the export.
- `bible-places.geojson` keeps only the features of the kept places, each with its `links` and `geometry` set to null (decision 41). Seir's feature has a synthetic second OpenBible link, to Edom's record, to test a place with two records.
- `ancient.jsonl` keeps the records the kept places link to, without `verses`, `extra`, `media`, and `identification_sources`. `modern.jsonl` keeps the records they resolve to, and their `root` records.
- Synthetic changes to modern records, to test the drop rules: Kadesh's (Ain el Qudeirat) source type is "osm"; Esek's has a `custom_lonlat` (commercial); Mamre's source type is "google_maps"; Shur's has no `coordinates_source` and a `root` that is Kadesh's record.
- Every modern record whose point the build drops (OpenStreetMap source or geometry, commercial, Google, or a `root` point) has made-up coordinates, 1.111111 and 2.222222, also in the ancient records that resolve to it. Any `custom_lonlat` is 5.555555,6.666666 (decision 44).

- The lookup files keep only the records that the kept modern records cite, directly or through their Wikidata items: Wikidata rows for their items, Pleiades locations of the Pleiades IDs, and GeoNames lines of the GeoNames IDs (a file with no such line is empty).
- `wikidata-coords.json` keeps a reference only when it cites OpenStreetMap. Canaan's coordinate (Q163329) has a synthetic reference "stated in" OpenStreetMap (Q936), to test decision 58. Every coordinate that cites OpenStreetMap has made-up values, 3.333333 and 4.444444 (decision 44).
- `NavesTopicalDictionary.csv` keeps the headings that file a kept verse, and `ACCOUNTABILITY`, a heading with only "See" lines. Each line keeps the text before its first reference, then only the references to verses in `verses.json` (a range only when all its verses are there, a whole chapter only when it is a kept chapter), joined with "; ". A line whose references are all cut is dropped; a line with no reference is kept as it is. `BIRTHRIGHT` has one synthetic line, `-Synthetic test line GEN 25:33-26:1; 11:33`, to test a range across chapters and a verse that does not exist. Two synthetic headings, `ABRAHAMUS (ABRAHAM)` and `ANTIPAS, HEROD`, test a heading spelt two ways and one written surname first (decision 169). `HAGAR THE EGYPTIAN` and `OHOLIBAMAH` test a heading that matches a curated alias (Hagar's synthetic alias) and one that matches a BSB name (decision 172).
- `pleiades-locations-latest.csv.gz` has empty `geometry` and `bbox`. Every location based on OpenStreetMap has made-up coordinates, 7.777777 and 8.888888 (decision 44).

## Curated tables

`curated/partners.csv`, `curated/possibly_same.csv`, `curated/corrections.csv`, `curated/themes_keep.csv`, and `curated/links.csv` are written by hand, not cut. They are this project's data (CC BY-SA 4.0, `LICENSE-DATA`). Rows copied from `pipeline/curated` keep their real values. Rows whose note starts with "Synthetic" are made up to test one case each: the `partner` relation (Esau and Basemath), an unreviewed row, an ID that is not in Theographic, a redundant correction (Beeri), a correction where Theographic holds neither value (Ur), alias corrections on two stubs (Lot's daughters), coordinate corrections that set Babel's point and remove Pau's, keep rows for GOD (reviewed) and MASTER (not reviewed), and link rows that remove Abraham's link to Isaac (not reviewed), add a parent with an ID not in Theographic, and add a Mention Theographic already has (redundant). `links.csv` also holds the real rows for Gen 36:25 and 1 Chr 1:41 (#44). Hagar has two partner rows, one for each relation (decision 104). Every Evidence Verse is in the kept chapters.
The TIPNR fixture is not cut by `cut.py`. It is written by hand (licences.md, section 5, rule 4), with CRLF line ends like the real file. It has three synthetic People, Peleg, Reu, and Serug, whose references are Genesis 11 verses, and one Place record that the check skips. Each record says "Synthetic TIPNR record, written for tests" and has a made-up Strong's number (`HX001` to `HX004`). Reu agrees with Theographic. Serug names Peleg, not Reu, as his father, to test the disagreement report. Peleg is Female, to test a gender disagreement. Peleg has one reference with a letter suffix and one LXX reference.

Rules for later fixtures are in `docs/licences.md`, section 5. In short: the TIPNR fixture is synthetic, and OpenStreetMap records use made-up coordinates.
