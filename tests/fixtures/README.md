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

Chapters: Genesis 11, 16, 25, 26, and 36; Matthew 17:20 to 22; 3 John 1.

Changes from the sources:

- KJV text is removed from `verses.json` (decision 42).
- `cross-references.zip` keeps the rows with an end in a kept verse (or at `3John.1.15`) whose other ends are outside Genesis, Matthew, and 3 John. `verses.json` also holds the Theographic records of those other ends, with only `osisRef` and `verseID`.
- `cross-references.zip` has two synthetic rows: `Matt.17.20` to `3John.1.15` (3 Votes), to test the remap to `3John.1.14`, and `Gen.11.1` to `Gen.11.33` (1 Vote), to test a cross-reference with no Verse Key.
- `bsb.txt` has one synthetic line, 3 John 1:15, to test a BSB verse with no Theographic key.
- The entity files keep the records that a kept verse mentions, and each record's `verses` keeps only the kept verses. They also keep the records that those records link to through an edge field (`father`, `mother`, `children`, `siblings`, the two half sibling fields, `partners`, `birthPlace`, `deathPlace`, `memberOf`, `participants`, `locations`), with no verses, to test stubs outside the book range. Edge fields keep only links to kept records.
- Abraham (`abraham_58`) has one synthetic verse link, `recFixtureNoVerse`, to test a mention with no Verse Key, and one synthetic sibling link, `recFixtureNoRecord`, to test an edge whose other end does not exist.
- Demetrius (`demetrius_1007`) has no `dictText`, but keeps `dictionaryText`, to test that no Dictionary Entry comes from `dictionaryText`.
- The Tribe of Judah has one synthetic verse link, to Genesis 36:1, because no People Group has a real verse in the kept chapters.
- Theographic coordinates in `places.json` (`latitude`, `openBibleLat`, `recogitoLat`, and the longitudes) are made up: -11.111111 and -22.222222. They can carry OpenStreetMap points (decision 41), and a test checks they never reach the export.
- `bible-places.geojson` keeps only the features of the kept places, each with its `links` and `geometry` set to null (decision 41). Seir's feature has a synthetic second OpenBible link, to Edom's record, to test a place with two records.
- `ancient.jsonl` keeps the records the kept places link to, without `verses`, `extra`, `media`, and `identification_sources`. `modern.jsonl` keeps the records they resolve to, and their `root` records.
- Synthetic changes to modern records, to test the drop rules: Kadesh's (Ain el Qudeirat) source type is "osm"; Esek's has a `custom_lonlat` (commercial); Mamre's source type is "google_maps"; Shur's has no `coordinates_source` and a `root` that is Kadesh's record.
- Every modern record whose point the build drops (OpenStreetMap source or geometry, commercial, Google, or a `root` point) has made-up coordinates, 1.111111 and 2.222222, also in the ancient records that resolve to it. Any `custom_lonlat` is 5.555555,6.666666 (decision 44).

- The lookup files keep only the records that the kept modern records cite, directly or through their Wikidata items: Wikidata rows for their items, Pleiades locations of the Pleiades IDs, and GeoNames lines of the GeoNames IDs (a file with no such line is empty).
- `wikidata-coords.json` keeps a reference only when it cites OpenStreetMap. Canaan's coordinate (Q163329) has a synthetic reference "stated in" OpenStreetMap (Q936), to test decision 58. Every coordinate that cites OpenStreetMap has made-up values, 3.333333 and 4.444444 (decision 44).
- `pleiades-locations-latest.csv.gz` has empty `geometry` and `bbox`. Every location based on OpenStreetMap has made-up coordinates, 7.777777 and 8.888888 (decision 44).

Rules for later fixtures are in `docs/licences.md`, section 5. In short: the TIPNR fixture is synthetic, and OpenStreetMap records use made-up coordinates.
