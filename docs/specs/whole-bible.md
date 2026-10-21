# Spec: The whole Bible (M6)

Status: ready-for-agent
Date: 2026-10-22
Sources: `PRD.md` (Draft 5, sections 8.2, 8.4, 8.5, 12, 13), `GLOSSARY.md`, `docs/decisions.md` (decisions 73, 77, 93, 122, 152 to 157, 161, 163 to 167), `docs/specs/genesis-data-build.md`, issues #16 and #44

Terms follow `GLOSSARY.md`. Published as issue #54. The issue is the working copy for agents. This file is the reference copy.

## Problem Statement

The live site (wendtheword.flying-ant.uk) covers Genesis only. Most Cross-references point to books outside the build, so a reader often meets "outside this build" and cannot read where a link leads, and People, Places, and Themes that matter in the rest of the Bible are missing or thin.

The pipeline was designed for the whole Bible (the book range is a config value), and a trial run on 2026-10-22 shows it runs: 28 seconds, about 1 GB of memory, 9,397 files (under the 20,000 limit), 637 MB in all. But the run also shows what breaks:

- **The size rule bites in the wrong place.** Nine files are over the 500 KB uncompressed rule (God 2.0 MB, Jesus 620 KB, six Themes up to 1.1 MB, and the search index 801 KB), and 68 chapter files lost low-vote Cross-references to stay under it (up to 4,310 each). Yet Cloudflare compresses every file in transit: God's file is 69 KB gzipped (48 KB brotli) and parses in about 5 ms. The rule limits bytes a reader never downloads.
- **Long lists.** A hub's panel can hold thousands of rows (God has 8,587 linked Verses and 2,512 Neighbours); drawing them all at once is slow.
- **Data quality is unreviewed at this scale.** The reports list 87 Places with no coordinates (including the 35 OpenStreetMap-only places of #16), 83 uncurated partner pairs, 356 TIPNR disagreements, 677 verse mismatches, 2,486 removed Nave's headings, and 729 aliases. Reading 14 TSV files is not a review.
- **Known errors need a new curation tool.** The Anah of Gen 36:25 is linked to the wrong Anah, and the curated tables cannot move a Mention or a family link (#44).

## Solution

1. **Ship the whole Bible**: the book range covers all 66 books, with a new data version, released through the M5 flow.
2. **A compressed size rule**: every file must be under 500 KB gzipped (and under Cloudflare's 25 MiB raw). Hubs stay single files, nothing is trimmed in practice, and the search index stays one file.
3. **Long lists page 100 at a time** in the panel and the reader-facing lists.
4. **A data quality summary page** written by every build, so the owner can review the reports in one place.
5. **Places without coordinates** (#16): each of the OpenStreetMap-only places gets a curated point, a GeoNames name match, or a recorded "no point".
6. **Curated link corrections** (#44): a curated table that adds or removes a Mention or an explicit family link, with Evidence Verses, and its first use for Gen 36:25.

## User Stories

### Reader

1. As a reader, I want every book of the Bible in the graph, so that I can follow a link wherever it leads.
2. As a reader, I want Cross-references from Genesis into the Gospels, the Prophets, and the Letters to open, so that I can read where a link leads.
3. As a reader, I want "outside this build" to be rare (only for the verses the BSB numbers differently), so that the graph rarely dead-ends.
4. As a reader, I want People, Places, Events, and Themes from every book, with their Dictionary Entries, so that I can study Paul, Jerusalem, or the Passover as I study Abraham.
5. As a reader, I want Ring 1 of a hub (God, Jesus, Jerusalem, Israel) to stay readable, with the same K of each type, so that hubs do not swamp the scene (decision 95, cosine weight).
6. As a reader, I want a hub to load as fast as any other node, so that God or Jesus as the Focus does not stall the page.
7. As a reader, I want long panel lists (8,587 Verses for God) to show 100 at a time with "Show 100 more", so that the panel stays quick.
8. As a reader, I want no Cross-references silently dropped from a chapter to fit a file limit, so that a well-voted link is never missing.
9. As a reader, I want the book filter to list all 66 books, so that I can keep Verses to the books I am studying.
10. As a reader, I want the reader panel's previous and next chapter to cross book boundaries (Malachi 4 to Matthew 1), so that I can read on.
11. As a reader, I want search to find any Person, Place, Event, Theme, or verse reference in the Bible as fast as now, so that the larger index does not slow me down.
12. As a reader, I want same-name hints and relations to cover the whole Bible (the many Zechariahs, Johns, and Marys), so that I can tell them apart (decisions 122, 125, 126).
13. As a reader, I want more Places on the map data with coordinates, so that place facts are complete.
14. As a reader, I want the Anah of Gen 36:25 linked to the right person, with the correction shown and its Evidence Verses, so that the family reads correctly.
15. As a reader who opened the page before a release, I want it to switch to the new data when I next load something (decision 159), so that the release does not break my session.
16. As a reader, I want links I saved for Genesis to keep working after the release, so that nothing I shared breaks (decisions 128, 149).

### Owner

17. As the owner, I want one data quality summary page from every build, with counts per report and per book and a sample of rows, so that I can review the whole Bible without reading TSV files.
18. As the owner, I want the summary page to show what changed since the previous build (counts up or down per report), so that I can see the effect of a curation or a source refresh.
19. As the owner, I want each OpenStreetMap-only Place decided (curated point, GeoNames name match, or no point) and recorded with its reason, so that #16 is closed with evidence.
20. As the owner, I want a curated table that adds or removes a Mention or an explicit family link (PARENT_OF, SPOUSE_OF, SIBLING_OF) with Evidence Verses, a note, `reviewed`, and `request`, so that I can fix link errors the way I fix fields.
21. As the owner, I want link corrections reported as redundant or no longer matching after a source refresh (decision 77), so that stale rows are found.
22. As the owner, I want the release to refuse a whole-Bible export that breaks the compressed size rule or has stale curated rows (decision 161), so that bad data never ships.
23. As the owner, I want the file size rule, the trimming report, the staged-site checks, and the release check to all use the same compressed rule, so that they agree.
24. As the owner, I want a new data version for the whole-Bible release, so that readers' cached Genesis files are not reused (decision 157).
25. As the owner, I want the deploy of 637 MB of data to stay within Cloudflare's free limits and finish in a reasonable time, so that releases stay routine.
26. As the owner, I want the whole-Bible acceptance test to check counts, limits, and the Ring 1 of a few hubs, so that a regression in ranking is caught.
27. As the owner, I want an upstream issue drafted for Theographic for each plain error I correct (PRD 10.5 rule 4), so that fixes flow back.

### Developer

28. As a developer, I want the size rule in one place (a compressed limit and a raw ceiling), so that the build, the staging tests, and the release share it.
29. As a developer, I want the fixture to include a few New Testament slices beside Genesis, so that multi-book behaviour is tested in CI.
30. As a developer, I want the whole-Bible acceptance test to run locally against the real sources and skip in CI, as the Genesis one does.
31. As a developer, I want list paging to be one shared piece of the panel, so that every long list behaves the same.

## Implementation Decisions

### Size rule

- **Every file must be under 500 KB gzipped and under 25 MiB raw** (decision 163). The build measures the gzipped size at level 9 (brotli at the edge is smaller still). Amends PRD 8.2 ("below 500 KB uncompressed"), PRD 8.5 rule 2, and decision 73: trimming of the lowest weight Cross-references now applies only to a file over the compressed limit, and the trimming report stays. `files.tsv` reports raw and gzipped sizes. The staged-site checks (#47) and the release gate (decision 161) use the same rule from one shared definition.
- One search index file, judged by the same rule (90 KB gzipped on the trial run).

### Whole Bible

- **Book range**: all 66 books in `build.toml`, and a new `data_version` (decision 164). The build date and data version are set for the release.
- **Cross-references**: with every book in range, a Cross-reference's both ends are in the build except where verse numbering differs; the "outside this build" path stays for those.
- **Front end**: the book filter's "This build" choice now means all built chapters; the reader's chapter buttons cross book boundaries in canonical order; search, hints, and relations need no change beyond scale. Long lists page 100 at a time (decision 165) with "Show 100 more" and a count, in the panel's Neighbour lists, linked Verses, shared Verses, and Overflow lists; the double click rule (M3) still holds.
- **Deploy**: Wrangler uploads by content hash, so a release uploads only files whose content changed; the first whole-Bible release uploads most of 9,400 files. The release zip is attached as before (GitHub's per-file limit is 2 GiB; the trial export compresses to well under that). The runbook gains the expected upload time.

### Data quality summary

- **Every build writes one summary page** in its reports folder (decision 166): one section per report with its row count, counts per book where the report has a Verse or Entity, the first rows as a sample, and a link to the TSV. When a previous build's reports are given, each count shows its change. Plain HTML with no scripts or network, so it opens from disk.

### Places without coordinates (#16)

- **Each OpenStreetMap-only Place is decided** (decision 167): first a GeoNames lookup by name and country (the build already has the GeoNames dumps) where exactly one match lies within the place's region, recorded with source GeoNames; otherwise a curated point in the corrections table with an Evidence Verse and a note on how the point was chosen (never an OpenStreetMap value, PRD 12 item 6); otherwise "no point", recorded with the reason. The no coordinate report lists what remains.

### Curated link corrections (#44)

- **A new curated table** for links: each row adds or removes one Mention (Verse Key, Entity ID) or one explicit family edge (two Entity IDs and the edge), with Evidence Verses, a note, `reviewed`, and `request`, following the other curated tables (decisions 35, 75, 77): only reviewed rows ship; a row that no longer matches is not applied and is reported; a redundant row (upstream now agrees) is reported. Corrected links show "Corrected after review" in the panel as other corrections do.
- **First rows**: move the Gen 36:25 Mention and the parent links of Dishon and `person:aholibamah_172` from `person:anah_248` (son of Seir) to `person:anah_249` (son of Zibeon), Evidence Gen 36:24 and 36:25, reviewed by the owner. The same-name relations (decisions 125, 126) are recomputed from the corrected links.
- An upstream issue for Theographic is drafted, not filed, for the owner (PRD 10.5 rule 4).

## Testing Decisions

- **Seams**: the existing ones (the build on fixtures, Vitest, Playwright, the staged site, the live check), plus:
  1. **A larger fixture.** A few New Testament slices beside Genesis (for example John 1 and Acts 2, with Matthew 17 and 3 John 1 already there) cut from the real sources by the fixture tool, so CI covers multi-book Cross-references, the book filter across books, the reader crossing a book boundary, and a hub large enough to page.
  2. **A whole-Bible acceptance test**, run locally against the real sources and skipped in CI (as the Genesis one is): 66 books; 1,189 chapters; 31,102 Verses (both as the trial run found); fewer than 20,000 files; every file under the compressed limit; no Cross-references trimmed; the Ring 1 People of Abraham, Jesus, and Paul as expected (values taken from the first run and stated in the test); God in the top 6 People of at most 10% of People.
- **What makes a good test here.** It states what a reader or the owner sees: "God's entity file is under 500 KB gzipped", "Malachi 4's next chapter is Matthew 1", "the Gen 36:25 Mention belongs to the son of Zibeon", "the summary page counts 87 Places without coordinates". Not how the build measures sizes or lays out the page.
- **Curated link corrections** are tested through the build seam with fixture rows: an added Mention, a removed Mention, a moved family edge, an unreviewed row, a row that no longer matches, and a redundant row.
- **The summary page** is tested through the build seam: it exists, opens without a network, and its counts match the TSV files.
- **Prior art.** `tests/test_genesis_full.py` (the slow real-source test), `tests/test_curated.py` (curated tables), `tests/conftest.py` and `tests/fixtures/cut.py` (the fixture), the staging and live-check tests in the front end package.

## Out of Scope

- The mobile release (M7).
- Phase 2 (word study, a second text, the NLT, verse text search, a Worker, D1, KV).
- Reviewing every report row by hand: the summary page makes review possible; the owner's review produces follow-up tickets.
- Curating the 83 uncurated partner pairs or resolving the 356 TIPNR disagreements (follow-up tickets from the review).
- New verse-numbering exceptions beyond what the review finds (follow-up tickets).
- Filing upstream issues on Theographic (drafted for the owner only).

## Further Notes

1. **Decisions 163 to 167** record this spec's choices: the compressed size rule (owner), the whole-Bible book range and new data version, long lists paged by 100, the data quality summary page (owner), and the per-place decision rule for #16 (owner chose to include #16 and #44).
2. **Trial run numbers** (2026-10-22, real sources, scratch folder): 9,397 files, 637 MB; reports: 729 aliases, 87 no coordinate, 2,486 removed Theme headings, 356 TIPNR disagreements, 83 uncurated partners, 677 verse mismatches, 3 curated upstream; entity files: 3,067 People, 1,288 Places, 450 Events, 18 People Groups, 2,193 Themes.
3. **Cloudflare total size.** The limits page sets no total size for static assets on the free plan (checked 2026-10-21 for files and per-file size); recheck before the release, since 637 MB is the largest upload so far.
4. **Phones (M7).** A 2 MB hub file parses in about 5 ms on the owner's Mac; check on a mid-range phone when M7 sets the phone limits.
