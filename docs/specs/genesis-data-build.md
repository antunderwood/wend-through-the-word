# Spec: Genesis data build (M0 to M2, plus the static export)

Status: ready-for-agent
Date: 2026-10-19
Sources: `PRD.md` (Draft 5), `GLOSSARY.md`, `docs/decisions.md` (decisions 1 to 34), `docs/prototypes/focus-model.md`

Terms follow `GLOSSARY.md`. Published as issue #1; its tickets are sub-issues #2 to #13. The issue is the working copy for agents. This file is the reference copy.

## Problem Statement

The owner wants a free, explorable graph of the Bible. The data exists in several open sources, but they do not fit together as they are. They use different verse references. Some coordinates carry a licence (ODbL) that cannot ship with CC BY-SA data. Theographic does not separate wives from concubines, and it has plain errors, such as Anah's gender. Raw co-mention counts make God the top Neighbour of almost everyone. Nave's headings duplicate people and places.

The focus model prototype showed that the disclosure rules work on real Genesis data. It used a throwaway script and an in-page data blob. There is no repeatable build, no record of where each fact came from, and no static files that a front end can load. The front end (M3) cannot start until this data exists.

## Solution

A Python build pipeline that runs from a clean checkout with one command. It reads downloaded source files and the owner's curated tables. It writes:

1. Static JSON files in the layout of PRD section 8.2: an index, chapter files with Ring 1 for each Verse, Ring 2 sidecar files, entity files, credits, and a search index.
2. Report files that record every dropped, unmatched, corrected, or disputed item.

Every node and every edge carries a `source` and a `licence`. Every file is below 500 KB. The book range is a config value, so the same build later runs on the whole Bible (M6).

M0 also sets up the repository (private until M5, decision 47), the "Correction request" issue form, the licence check in `docs/licences.md`, and the download script with checksums.

## User Stories

### Owner: repository and licences (M0)

1. As the owner, I want a GitHub repository, public from the M5 launch (decision 47), so that readers can see the data and send Correction Requests.
2. As the owner, I want the code under MIT and the data under CC BY-SA 4.0, so that the two licences are clear and separate.
3. As the owner, I want the LICENSE file of every source repository read and recorded in `docs/licences.md`, so that each licence decision has a dated record.
4. As the owner, I want the build to refuse any CC BY-NC source, so that a non-commercial licence never enters the dataset by mistake.
5. As the owner, I want my reading of the OpenBible.info licence split (CC BY parts and ODbL parts) recorded in `docs/licences.md`, so that the basis of the coordinate decision is visible.
6. As the owner, I want the KV, R2, and static asset limits checked on the official Cloudflare pages and recorded, so that the budget does not rest on secondary sources.
7. As the owner, I want one download command that fetches every source, so that I do not fetch files by hand.
8. As the owner, I want each download to record its URL, date, and SHA-256 checksum in a manifest, so that I can tell when a source has changed.
9. As the owner, I want to supply a file by hand when a host is blocked, and have its checksum recorded the same way, so that a blocked host does not stop the build.
10. As the owner, I want a "Correction request" issue form with stable field IDs, so that later "Suggest a correction" links can prefill it.
11. As a reader, I want the issue form to ask for at least one Evidence Verse, so that I know a request without a verse will not be accepted.
12. As a reader, I want the form to state that my suggestion may be included under CC BY-SA 4.0, so that I know how my words will be used.
13. As a reader, I want the form to say that BSB wording and Easton's articles are fixed texts, with a link to the BSB publisher, so that I send text issues to the right place.
14. As the owner, I want CI to run `ruff` and `pytest` on every push, so that a broken build is caught before it ships.

### Owner: text and verse keys (M1)

15. As the owner, I want the BSB text for the configured book range loaded by Verse Key, so that every Verse has its text.
16. As the owner, I want Genesis to load as 50 chapters and 1,533 verses, so that I know the text is complete.
17. As the owner, I want Theographic's `verseID` used as the Verse Key with no mapping table, so that the build stays simple.
18. As the owner, I want `3John.1.15` from OpenBible mapped to `3John.1.14`, so that the cross-reference is not lost.
19. As the owner, I want the sixteen BSB verses with no text kept and marked "no BSB text", so that links to them still resolve.
20. As the owner, I want Rev 12:17 and the Psalm title placement noted but not changed, so that the known differences are on record.
21. As the owner, I want a mismatch report over every source, with the count and cause of each unmapped link, so that no data is dropped without a record.
22. As the owner, I want every Theographic verse link for the book range to have a BSB Verse Key or to appear in the mismatch report, so that I can trust the links.

### Owner: Entities and links (M1)

23. As the owner, I want People, Places, Events, and People Groups loaded from Theographic with prefixed IDs (for example `person:abel_13`), so that every Entity has one stable ID.
24. As the owner, I want Theographic to stay the identity authority, so that the build never merges two Entities.
25. As the owner, I want the Dictionary Entry taken from `dictText` and never from `dictionaryText`, so that no broken characters ship.
26. As the owner, I want Event Years converted with care from astronomical numbering (4004 BC is -4003), so that no year is off by one.
27. As the owner, I want People to carry no years, so that the app does not show a contested date as fact.
28. As the owner, I want MENTIONS links from Verses to People, Places, Events, and People Groups, so that each Verse names its Entities.
29. As the owner, I want family links (PARENT_OF with a father or mother role, SIBLING_OF, and HALF_SIBLING_OF where Theographic gives it) loaded with their direction kept, so that "father" and "son" are never swapped.
30. As the owner, I want PARTICIPATED_IN, OCCURRED_AT, BORN_AT, DIED_AT, and MEMBER_OF loaded with their direction kept, so that the front end can read each edge from either end.
31. As the owner, I want edges with a missing or unclear source not loaded, and listed in a report, so that every shipped link can be traced.

### Owner: curated tables

32. As the owner, I want each Theographic partner pair resolved through `partners.csv` into SPOUSE_OF, CONCUBINE_OF, both, PARTNER_OF, or none, so that "wife" and "concubine" follow the BSB text.
33. As the owner, I want a pair marked "none" (Anah and Beeri) to ship no partner edge, so that a known error does not reach readers.
34. As the owner, I want partner pairs that have no curated row to ship as PARTNER_OF and appear in a report, so that I can see what still needs review.
35. As the owner, I want POSSIBLY_SAME_AS links loaded from `possibly_same.csv`, with their Evidence Verses and note, so that a tradition's reading is shown without merging two People.
36. As the owner, I want attribute fixes from `corrections.csv` (for example Anah's gender) applied over Theographic, so that plain errors are fixed in the shipped data.
37. As the owner, I want only rows with `reviewed` set to yes to ship, and the others reported, so that nothing I have not reviewed reaches readers.
38. As the owner, I want every curated row to require an Evidence Verse, and the build to fail on a row without one, so that the rule "no verse, no change" holds.
39. As the owner, I want each shipped curated item to carry its Evidence Verse, note, and `request` link in the export, so that the detail panel can show "Corrected after review" with the request.
40. As the owner, I want the build to report curated rows that are redundant after a Theographic refresh, so that I can remove fixes that upstream has made.
41. As the owner, I want the build to report and not apply curated rows that no longer match (an ID or value changed), so that a stale fix never corrupts new data.
42. As the owner, I want curated rows marked as plain Theographic errors to be listed for upstream reporting, so that I remember to open an issue on the Theographic repository.

### Owner: cross-references, coordinates, themes, checks (M2)

43. As the owner, I want OpenBible cross-references loaded as CROSS_REF edges with their Votes, so that the front end can filter by Votes.
44. As the owner, I want cross-references kept when one end is outside the book range, so that a Genesis Verse can still link to a Psalm.
45. As the owner, I want CC BY OpenBible coordinates loaded with their confidence, so that most Places have a point.
46. As the owner, I want every OpenStreetMap or commercial coordinate dropped, so that no ODbL data ships.
47. As the owner, I want dropped Places looked up again in Pleiades, then Wikidata, then GeoNames, with the source recorded on each coordinate, so that most of them still get a point.
48. As the owner, I want a report of Places with no coordinate, so that I know the gaps.
49. As the owner, I want a test that fails if any shipped coordinate comes from OpenStreetMap, so that the licence rule cannot regress.
50. As the owner, I want Nave's headings loaded as Themes, with FILED_UNDER links from Verses, so that readers can explore topics.
51. As the owner, I want headings that are Theographic people or places removed, and listed in a report, so that no Entity is duplicated.
52. As the owner, I want CO_MENTION edges derived for every pair of Entities that share a Verse by Mention or Filed Under, so that most People link to more than unranked Verses.
53. As the owner, I want the CO_MENTION weight to be the cosine score, so that God is not the top Neighbour of everyone.
54. As the owner, I want God in the top 6 People of at most 10% of Genesis People, and Abraham's top 6 People to be Isaac, Sarah, Heth, Abimelech, Nahor, and Lot, on the full Genesis data, so that I know the cosine weight works (decision 97).
55. As the owner, I want each CO_MENTION edge to carry its shared verse count, so that the front end can say "together in N verses".
56. As the owner, I want TIPNR matched to Theographic by verse overlap, and a report of Genesis People where they disagree on identity or family links, so that I can find errors without shipping TIPNR.
57. As the owner, I want no TIPNR data in the static export, so that I respect its request not to be reposted.

### Front end developer: the static export

58. As a front end developer, I want `index.json` with the book list, counts, build date, data version, and licences, so that the app knows what data it has.
59. As a front end developer, I want one chapter file for each chapter, with the Verses and the Ring 1 links of each Verse, so that the reader panel and a Verse Focus need one fetch.
60. As a front end developer, I want a Ring 2 sidecar for each chapter, with IDs and weights only, so that the main chapter file stays small.
61. As a front end developer, I want one entity file for each Entity, with its facts, its Neighbours sorted by weight, and the Overflow count for each type, so that an Entity Focus needs one fetch.
62. As a front end developer, I want the top 10 Neighbours of each Ring 1 node inside the entity file, so that the browser can filter them and show 3 as Ring 2 with no second fetch.
63. As a front end developer, I want each Neighbour to carry its ID, type, edge type, direction, and weight, so that I can rank and label it.
64. As a front end developer, I want the Neighbours of each type ranked by weight alone, with an explicit edge as a label and not a priority, so that Ring 1 shows the strongest links (decision 94).
65. As a front end developer, I want Verse Neighbours of an Entity ranked by the number of other Entities in the Verse, so that the heuristic in PRD 10.4 is applied once at build time.
66. As a front end developer, I want each Person's gender in the export, so that Relationship words follow the Neighbour's gender.
67. As a front end developer, I want Themes stored as Entities under the same layout, so that I handle one file shape.
68. As a front end developer, I want `search-index.json` with names, aliases, types, and IDs of all Entities (Themes included), plus the book and chapter list, so that search runs in the browser.
69. As a front end developer, I want the search index to be the label lookup for Ring 2 IDs, so that Ring 2 entries stay small.
70. As a front end developer, I want a search for "Abraham" in the index to return `person:abraham_58`, so that the most common case works.
71. As a front end developer, I want the data version in each file name and in `index.json`, so that data files can be cached for a long time.
72. As a front end developer, I want `credits.json` to list every source with its licence and link, so that the credits page needs no hand editing.

### Owner: limits and repeatability

73. As the owner, I want every exported file below 500 KB uncompressed, so that each view loads fast.
74. As the owner, I want a file that is too large to be split, or its lowest Vote cross-references trimmed, and the action reported, so that the limit never fails silently.
75. As the owner, I want the search index below 500 KB compressed, so that the first load stays fast.
76. As the owner, I want the build to report the total file count, so that I can watch the 20,000 file limit before M6.
77. As the owner, I want the same inputs to give byte-identical outputs, so that a diff of the export shows real data changes only.
78. As the owner, I want no Genesis-only logic, so that M6 is a config change.
79. As the owner, I want every Verse, Entity, and edge in the export to carry a `source` and a `licence`, and a test to check this, so that the CC BY-SA attribution holds.

## Implementation Decisions

### Shape of the pipeline

- Two commands. `download` fetches sources and writes the checksum manifest. `build` reads only local files: the downloaded sources, the curated tables, and the config. `build` never touches the network. This keeps the build repeatable and testable.
- `build` has one entry point that takes a config (book range, source paths, output path). It writes the static export and the reports. This entry point is the one test seam.
- The SQLite graph is an internal working store. Tests do not read it. Its schema can change freely.
- Python, with standard tools first: `sqlite3`, `pandas`, `networkx` only where they help. No Rust.
- Modules follow the layout suggested in PRD section 9. Their internal interfaces are free to change; only the export and the reports are contracts.
- The re-sourced coordinates (Pleiades, Wikidata, GeoNames) are fetched by `download` into local files, not looked up during `build`.

### Verse keys

- The Verse Key is Theographic's `verseID` (`BBCCCVVV`). The label is OSIS (`Gen.1.1`).
- The four exceptions of PRD 7.1 live in one place. Only the `3John.1.15` remap changes data. The others are flags or notes.

### Ranking and weights

- Weight of a CROSS_REF edge: its Votes.
- Weight of a CO_MENTION edge: shared Verses divided by the square root of (Verses of A times Verses of B). The Verse set of an Entity is the union of its Mention and Filed Under Verses, across the whole Bible, so weights do not change when the book range grows. A pair gets the edge only when it shares a Verse in the book range, and its shared verse count holds only those (decision 95).
- Neighbour order: weight, descending. An explicit relationship edge is a label, not a priority; the prototype's "explicit edges first" rule is dropped (decision 94). When one pair has several edges (for example SPOUSE_OF and CO_MENTION), they are one Neighbour with a combined edge type, as in the prototype.
- Verse Neighbours of an Entity: weight is the number of other Entities in that Verse.
- Ties break on ID, so the output is stable.

### Partners

- `partners.csv` relation values: `spouse`, `concubine`, `partner`, `none`. A pair that is both wife and concubine has one row for each, each with its own evidence (decision 104).
- `spouse` gives SPOUSE_OF, `concubine` gives CONCUBINE_OF, `partner` gives PARTNER_OF, `none` gives no partner edge.
- A Theographic partner pair with no row ships as PARTNER_OF and is reported as uncurated.

### Curated tables

Current headers (on `main`):

```
partners.csv       man_id,woman_id,relation,evidence,note,reviewed,request
possibly_same.csv  a_id,b_id,evidence,note,reviewed,request
corrections.csv    id,field,was,value,evidence,note,reviewed,request
themes_keep.csv    heading,evidence,note,reviewed,request
```

- `themes_keep.csv` lists Nave's headings that stay Themes although they match a Theographic Person or Place by name or alias (decision 103).

- `was` in `corrections.csv` is the upstream value the row was written against (for Anah: `F`). It makes a changed value detectable (decision 35).

- `evidence` holds one or more OSIS labels, separated by `;`. Each must be a valid Verse Key after parsing, or the build fails.
- A row ships only when `reviewed` is `yes`.
- Redundant: upstream now has the curated value. The row still applies; the report suggests removal.
- No longer matches: an ID is missing upstream, or, for `corrections.csv`, upstream holds neither `was` nor `value`. The row is not applied, and the report lists it.
- For `corrections.csv`, redundant means upstream now holds `value`.
- Each shipped curated item carries its evidence, note, and request URL into the entity file.

### Half siblings

- HALF_SIBLING_OF ships only when Theographic gives it explicitly (decision 36). The build does not derive it from shared parents. Theographic has the fields `halfSiblingsSameFather` and `halfSiblingsSameMother` (checked 2026-10-19). HALF_SIBLING_OF comes from these fields only.

### Coordinates

- Each coordinate records `coord_source`. Allowed values: OpenBible (CC BY points only), Pleiades, Wikidata, GeoNames, Curated (decision 89).
- An OpenBible point whose `coordinates_source.type` is `osm`, or which came from the commercial source, is dropped before any lookup.

### Static export

- Layout as in PRD 8.2, with the data version in file paths and in `index.json`.
- Ring 2 entries hold an ID and a weight only.
- Each entity file holds the full sorted Neighbour list (needed for Overflow lists), the Overflow count for each type at the default K, and the top 10 Neighbours of each of its top Neighbours.
- The export holds Person gender, edge direction, Event Years in astronomical numbering, and the Dictionary Entry. Formatting years as BC or AD is front end work.
- Output is deterministic: sorted keys, sorted lists, no timestamps except the build date in `index.json`, which comes from the config.

### Reports

Plain files in one reports folder: verse mismatches, dropped edges (no source), places with no coordinate, removed theme headings, TIPNR disagreements, uncurated partner pairs, unreviewed curated rows, redundant curated rows, curated rows that no longer match, curated rows to report upstream, split or trimmed files, and file counts and sizes.

### Repository (M0)

- The issue form is a GitHub Issue Form YAML file. Its field IDs are stable, because M4 prefills them through URL query parameters: node IDs, current value, data version, and page URL.
- `docs/licences.md` records each source, its licence, the date checked, and the basis.

## Testing Decisions

- **One seam.** Every automated test runs the `build` entry point on a small fixture set and asserts only on the static export and the reports. No test imports a pipeline module or reads the SQLite store.
- **What makes a good test here.** It states a rule from the PRD in terms a reader could check in the shipped files: "no shipped coordinate has an OpenStreetMap source", "the Anah and Beeri pair has no partner edge", "every file is below 500 KB". It does not check how a module computes something.
- **Fixtures.** A few hand-cut chapters (for example Genesis 11, 16, 25, 26, and 36, and 3 John 1) with matching slices of BSB, Theographic, OpenBible cross-references and geocoding, Nave's, and copies of the curated tables. The TIPNR fixture is synthetic, because TIPNR asks not to be reposted. Fixture data keeps its source licence; a README in the fixture folder says so.
- **Cases the fixtures must cover:** each verse exception; a mention with no BSB key; an OpenStreetMap point that is re-sourced and one that is not found; a Nave's heading that matches a Person; a partner pair for each relation value, an uncurated pair, and an unreviewed row; a correction that is redundant and one that no longer matches; a curated row with no evidence (the build fails); an oversized file that is split or trimmed; a hub Entity in enough Verses to check that cosine weight demotes it.
- **Determinism test.** Two builds of the same fixtures give byte-identical output.
- **Full Genesis acceptance run.** A slow test, run locally and before each milestone note, on the real downloaded sources. It checks the counts in PRD section 12 (50 chapters, 1,533 Verses), that God is in the top 6 People of at most 10% of Genesis People, that Abraham's top 6 People are Isaac, Sarah, Heth, Abimelech, Nahor, and Lot (decision 97), and that every file passes the size limit. It is skipped when the sources are missing, so CI stays offline.
- **Prior art.** There are no tests in the repository yet. The prototype's `build_data.py` on the `prototype/focus-model` branch shows how the sources are read, and its `FocusModel` shows what the front end expects from the data.

## Out of Scope

- Any front end code, including the M3 navigation prototype and the node limit test.
- The Cloudflare deploy and the Wrangler configuration (M5).
- Running the whole Bible (M6). The design must allow it, but this spec ships Genesis.
- Any Worker, D1, or KV code.
- The NLT display, word study, a second text, modern dictionary text, and verse text search (phase 2).
- The email fallback address for Correction Requests (PRD open question 13).
- A curated modern theme list.
- Original summaries for Entities, and birth or death years for People.

## Further Notes

Points found while writing this spec. Decisions 35 to 37 settle the first three. The rest are open.

1. **`corrections.csv` now has a `was` column** (decision 35).
2. **Half siblings come from Theographic only** (decision 36).
3. **The static export moves from M3 to M2** (decision 37).
4. **The prototype has no Themes.** Its type list is person, place, event, group, verse. The export adds Themes, so Ring 1 gains a sixth type and the Ring 2 maximum in PRD 10.4 (about 108) assumes six types already.
5. **Hub entity files at M6.** The full Neighbour list for God (8,587 Verses plus Co-mentions) may pass 500 KB for the whole Bible. Genesis is fine. M6 may need an Overflow sidecar file.
6. **Licence of test fixtures.** Fixtures in an MIT code repository will hold CC BY-SA (Theographic) and CC BY (OpenBible) excerpts. A licence note in the fixture folder covers this; record it in `docs/licences.md`.
