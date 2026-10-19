# 02: Tracer: `build` writes Genesis Verses

**What to build:** the first end-to-end path through the build. The owner runs one offline `build` command with a config (book range, source paths, output path, build date, data version). It reads the BSB text and writes `index.json` and one chapter file for each chapter in the book range, with each Verse's Verse Key, OSIS label, and text. This ticket also sets up everything every later ticket relies on: the fixture set, the one test seam, and the checks that run over every exported file.

Verse Keys are Theographic's `verseID` (`BBCCCVVV`), with no mapping table. Verses with no BSB text stay in the export, marked "no BSB text". The verse exceptions from PRD 7.1 live in one place (Rev 12:17 and the Psalm titles are noted only; the `3John.1.15` remap is applied in ticket 08).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `build` reads only local files and never touches the network
- [ ] Tests run only the `build` entry point on fixtures, and assert only on the export and the reports. No test imports a pipeline module or reads the SQLite store
- [ ] The fixture folder holds hand-cut chapters (Genesis 11, 16, 25, 26, 36, and 3 John 1), and a README says each excerpt keeps its source licence
- [ ] `index.json` holds the book list, counts, build date (from the config), data version, and licences
- [ ] The data version is part of every data file path
- [ ] Every Verse in the export carries a `source` and a `licence`. A test checks this for every node and edge in the export, so later tickets are covered too
- [ ] A test fails if any exported file is 500 KB or larger. A report lists the file count and each file's size
- [ ] Two builds of the same fixtures give byte-identical output (sorted keys and lists, no timestamps except the configured build date)
- [ ] Nothing in the code is specific to Genesis: the book range comes from the config
- [ ] A slow acceptance test runs the build on the real downloaded sources and checks 50 Genesis chapters and 1,533 Verses. It is skipped when the sources are missing, so CI stays offline
