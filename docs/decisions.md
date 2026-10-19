# Decisions

Each entry has a date and a reason. Terms follow `GLOSSARY.md`.

## 2026-10-18: Design review of PRD Draft 3

1. **"Group" is split into two terms.** The node type is People Group. The collapsed "+N" node is an Overflow Node. Reason: one word meant two things.
2. **Book is not a node.** `IN_BOOK` is removed. Reason: every book becomes a hub with thousands of edges. The verse key already gives the book.
3. **Co-mention links are added.** Two Entities that share a verse get a derived CO_MENTION link. Reason: without it, most people link only to unranked verses.
4. **The Trail is drawn in the scene.** The last 5 Focus nodes stay as small dim nodes on a path line. A breadcrumb row shows the same nodes.
5. **Version 1 is static files only.** No Worker script, D1, or KV. The NLT display moves to phase 2. Reason: the NLT was the only reason for a Worker, and its free tier access is unverified.
6. **Themes come from Nave's, in M2.** Headings that are people or places are removed. Reason: they would duplicate Theographic entities. The licence is CC BY 4.0 (README), so it is not a blocker.
7. **Theographic decides entity identity. TIPNR is a build-time check only.** Reason: TIPNR has no join key to Theographic, its short descriptions are adapted from AI output, and it asks not to be reposted. Its Strong's numbers are kept for phase 2.
8. **A Theme is an Entity.** Themes live at `/data/entity/theme/`. Reason: one file layout and one ID scheme.
9. **Only Events show years, labelled "approx., Jones chronology".** People show no years. Reason: Theographic follows one chronology (Floyd Nolen Jones), and only 70 of 3,067 people have a birth year.
10. **OpenStreetMap coordinates are replaced.** See the record below.
11. **The verse key is Theographic's `verseID`, with a short exception list.** No mapping table. Reason: the BSB and the KJV have the same 31,102 verse keys (checked 2026-10-18).
12. **`summary` becomes `dictionary_entry`, from Easton's (1897).** It is always labelled with its source. Reason: the PRD had no source for summaries, and 1897 prose must not look like the app's own words.
13. **The Verse to Theme link is FILED_UNDER, not MENTIONS.** Reason: a verse does not name a theme. Nave placed it there.
14. **Co-mention includes every Entity type, with no minimum count.** Reason: top K ranking already removes weak links.
15. **An Overflow Node opens a list in the detail panel.** It never adds nodes to the scene. Reason: the node limit always holds.
16. **Ring 2 shows up to 3 neighbours of each Ring 1 node.** The entity file stores the top 10, and the browser filters them. Reason: one fetch per click, and the filters still work.
17. **Up to 3 Pinned Nodes. A pinned node brings no neighbours.** Reason: it keeps the node count predictable.
18. **The code licence is MIT.** The data stays CC BY-SA 4.0.
19. **The owner has a Cloudflare account.**
20. **Co-mention weight is the cosine score.** Reason: with raw counts, God (8,587 verses) is the top neighbour of almost everyone. With cosine, Abraham's top neighbours are Isaac, Sarah, Heth, Abimelech, Nahor, and Lot (checked on Theographic data). Cost: God rarely appears in Ring 1. Users reach God through search or an Overflow list.
21. **Ring 2 for a Verse focus is in a chapter sidecar file.** Reason: per-verse files (31,102) pass the free limit of 20,000 files. Ring 2 entries hold IDs and weights only. Labels come from the search index.
22. **Search covers names, aliases, and verse references only.** Verse text search is phase 2.
23. **Visual references are deferred to the M3 node look prototype.**
24. **A click selects. A double click moves the Focus.** The detail panel shows the Selected Node, with Prev and Next along the Trail. This reverses PRD 10.2 rules 1 and 2. Reason: in the focus model prototype, reading about Trail nodes meant moving the Focus back, which rebuilt the scene and (with rewind) erased the Trail.
25. **Pinned Nodes bring their own top 3 neighbours of each type, and shared nodes are highlighted.** This replaces decision 17's "no neighbours". Reason: in the prototype, a pin with no neighbours showed nothing about the pinned node itself, and its edges to the screen (29 for Abraham with Jacob as Focus) were noise. Worst case with 3 pins stays under the phone limit.
26. **Edges from the Focus carry a relationship label, read from the Focus.** Family words follow gender (father, son, sister). Partners stay "partner". Co-mention-only links are dashed and say "together in N verses". Other edges show labels on hover. Reason: the PRD gave edges only a colour, so "Abraham and Sarah are partners" was not visible in the scene. "Wife" was rejected because Theographic's `partners` field includes Hagar and Keturah.
27. **Partners become husband or wife where a verse says so.** This amends decision 26. A curated table, `pipeline/curated/partners.csv`, holds each Genesis partner pair with a word (spouse, concubine, partner) and an evidence verse. Rule: spouse when a BSB verse calls her his wife or him her husband; concubine when only "concubine" is used; partner otherwise. So Hagar, Keturah, Bilhah, and Zilpah are wives (Gen 16:3, 25:1, 30:4, 30:9), even though other verses call some of them concubines. Reumah and Timna are concubines. Claude drafted the rows from the BSB text; the owner reviews each one (`reviewed` column). Anah and Beeri have no evidence and look like a data error.
28. **Owner review of the partner table (2026-10-18).** Hagar, Keturah, and Bilhah are both wife and concubine, because the text uses both words for each. Anah and Beeri are not partners: they are linked as "possibly the same person" (POSSIBLY_SAME_AS), because a traditional harmonisation of Gen 26:34 and Gen 36:2 reads them as one. They stay two People. Anah's gender is corrected to male (BSB Gen 36:24). This refines decision 7: Theographic still decides identity. The owner may add curated links and attribute corrections, each with an evidence verse, but never merges two entities. Theographic's `israel_682` is Jacob.
29. **Readers can send Correction Requests (PRD 10.5).** Channel: a GitHub Issue Form in the public repository, with an email fallback to a project-only address. The owner copies emails into issues without personal details, then deletes them. Scope: relationships, entity facts, and verse links; source texts are out of scope. A verse is required. Entry points: "Suggest a correction" in the detail panel and beside each fact, prefilled with IDs, the current value, and the data version. Accepted requests become curated rows with a `request` link. Plain Theographic errors are also reported upstream; editorial choices stay local. The build reports curated rows that are redundant or no longer match after a refresh. The repository becomes public at M0 (changed to M5 by decision 47). Reason: corrections such as Anah and Beeri show the data needs a steady, reviewable way in, without adding a Worker to version 1.
30. **The "Genealogy of Jesus" People Group stays in Ring 1.** Reason: the link matters, and the group is small (143 members across the whole Bible, from Theographic). From a patriarch it is one node. With the group as Focus, Ring 1 shows the top K people and an Overflow Node for the rest.
31. **"Trail" is renamed "Your Path".** Same behaviour: the last 5 Focus nodes, drawn as dim nodes on a line to the Focus and shown as a breadcrumb row. Reason: the owner found "Trail" unclear. Earlier decisions that say "Trail" mean Your Path.
32. **Your Path covers the whole session; the scene draws only the last 5.** The breadcrumb row and Prev and Next reach every Focus of the session. Reason: the limit of 5 came from the first PRD draft, not from evidence. The real limit is clutter in the 3D scene, not memory or the node budget.
33. **The node limit trims round robin, and says so.** Order between groups: ring 2, then the oldest nodes on Your Path, then the neighbours around pins. Within ring 2 and around pins, each parent loses its third neighbour before any parent loses its second. A corner note gives the number hidden. Reason: the prototype first trimmed by type order (the neighbours of verses before those of people), which was a side effect of the code, not a choice. Weights are not compared across types because their scales differ (votes, co-mention strength, entity counts). Checked on Abraham: at a limit of 60, all 23 ring 1 nodes keep 1 or 2 ring 2 neighbours.
34. **Close of the focus model prototype (2026-10-19).** Prev and Next walk Your Path only. Family links before co-mention in Ring 1, and how broad shared nodes are, are reviewed in M3. Navigation needs its own design: a fully 3D view is likely confusing, so M3 starts with a UI prototype of 2.5D navigation, which also decides whether free orbit stays. Findings: `docs/prototypes/focus-model.md`. Prototype: branch `prototype/focus-model`.

## 2026-10-19: Spec for the Genesis data build

35. **`corrections.csv` gets a `was` column.** It holds the upstream value that a fix replaces (Anah's gender: F). Reason: without it, the build cannot tell when upstream has changed the value under a fix, so "no longer matches" (PRD 10.5 rule 5) would only catch missing IDs.
36. **HALF_SIBLING_OF ships only when Theographic gives it.** The build does not derive it from shared parents. Reason: Theographic decides identity and family links (decision 7). Derived links would depend on how complete its parent data is. If Theographic has no such field, "half-brother" and "half-sister" leave PRD 10.4. Checked 2026-10-19: Theographic has `halfSiblingsSameFather` (111 people) and `halfSiblingsSameMother` (3 people), so HALF_SIBLING_OF ships from those fields and "half-brother" and "half-sister" stay.
37. **The static export moves from M3 to M2, and the build has one test seam.** Tests run the build command on fixture sources and check only the static export and the reports. Reason: the export is the contract with the front end. Tests on internal modules or the SQLite store would break when internals change. Spec: `docs/specs/genesis-data-build.md`.

## 2026-10-19: Licence check (M0)

Source: `docs/licences.md`.

38. **Easton's ships as public domain.** Licence field: "Public domain (1897)". Reason: the author died in 1894. CCEL asks for permission to republish its editions, but that is a site policy, not a licence term on the text, and we take plain text through Theographic. The owner accepts the remaining risk.
39. **The 11 commercial OpenBible points are dropped and re-sourced.** `custom_lonlat` is not used. Reason: their licence is not stated. No licence, no ship.
40. **The 6 Google sourced OpenBible points are dropped and re-sourced.** Reason: Google's terms restrict copying map data, whatever OpenBible's readme says. Six places is a small cost.
41. **No Theographic coordinate field ships.** Reason: Theographic's `latitude` and `longitude` are chosen from OpenBible and Recogito, so they can carry OpenStreetMap points.
42. **No KJV text goes into the export or the fixtures.** Reason: Theographic `verses.json` holds KJV text, and its UK status (Crown rights, managed by Cambridge University Press) is unverified. We do not need it.
43. **A Wikidata coordinate whose reference says it came from OpenStreetMap is not used.** Reason: CC0 on Wikidata does not clean ODbL data copied into it.
44. **Fixtures use made-up coordinates for OpenStreetMap records.** The source type stays "osm". Reason: a real OpenStreetMap point in a public repository is ODbL data, even if it never ships.
45. **The credits page says the data is modified and links to Theographic's source bibliography.** Reason: CC BY-SA 4.0 section 3(a)(1)(B) requires a modification notice, and Theographic asks users to credit its original sources.

46. **The credits page thanks STEPBible for TIPNR, marked "used to check the data; nothing from it is included".** Reason: the licence does not require credit, because nothing ships, but TIPNR helps find errors, and it already reaches us through Theographic.

## 2026-10-19: Repository visibility

47. **The repository stays private until the M5 launch.** This amends decision 29, which made it public at M0. Reason: no licence requires a public repository. CC BY-SA 4.0 binds the data we hand out, and the site hands it out with credits and the modification notice. Only three things need the repository public: readers opening Correction Requests, the credits link to the curated tables, and transparency. None is needed before launch. "Suggest a correction" links are tested in M4 as a collaborator.

## 2026-10-19: Tracer build (#3)

48. **The build has no SQLite store until a step needs graph queries.** It works in memory for now. This defers the "SQLite internally" part of the spec. Reason: the Verse export needs no queries, and tests never read the store, so adding it later changes nothing they check. Add it when CO_MENTION or ranking (#8) needs it.
49. **`index.json` sits outside the versioned folder.** Every other data file is under `data/<data version>/`. Reason: the front end loads `index.json` first to learn the current data version, so it cannot be inside that version.

## 2026-10-19: Source details for the Genesis build

From the source notes written for tickets #4 to #13.

50. **Gender uses Theographic's values, `Male` and `Female`, everywhere.** `corrections.csv` uses them too (Anah: was `Female`, value `Male`). Reason: `was` must match the upstream value exactly (decision 35), with no mapping in between.
51. **Entities outside the book range ship as stubs when an explicit edge links them to an Entity in range.** A stub file holds the Entity's facts and its Neighbours in range. Reason: 14 People Groups (including Genealogy of Jesus, decision 30) and 75 children have no Genesis verse but belong to Genesis People. Cross-references already keep ends outside the range (spec, user story 44). *Amended 2026-10-19 (#6, owner):* only People reached by a family edge and People Groups reached by MEMBER_OF ship as stubs. PARTICIPATED_IN, OCCURRED_AT, BORN_AT, and DIED_AT edges whose other end is outside the range are dropped and listed in `dropped_edges.tsv` until M6. Reason: under the first rule, Genesis gained 152 Event stubs, 102 of them through Jesus.
52. **A cross-reference to a range is one edge to the first verse, with `to_end_key`.** Reason: 88,150 OpenBible rows target a range. One edge per row keeps Votes unrepeated, and the end key lets the front end show "Gen 1:1-3".
53. **Cross-references with zero or negative Votes are kept.** The front end's default filter hides them (PRD 12.4). Reason: the data stays complete, and trimming for size already drops the lowest Votes first.
54. **People Group IDs are `group:` plus the group name in lower case, with spaces as underscores.** Reason: Theographic gives groups no ID field. The prototype used the same rule.

## 2026-10-19: Entities and Mentions (#4)

55. **Links in a Dictionary Entry become plain text.** Theographic's `dictText` holds Markdown links such as `[Gen. 11:27](/gen#Gen.11.27)`; the export keeps only "Gen. 11:27". Reason: the links point at paths on Theographic's own site, and the prototype did the same. Other Markdown (paragraph breaks) is kept. Turning the references into verse links in the app is a later choice.

## 2026-10-19: Coordinates and themes

Numbers start at 56, because ticket #4 records decision 55.

56. **A Theographic place joins its OpenBible record through Theographic's `geo/bible-places.geojson`.** The build uses only each feature's `links` (OpenBible, Pleiades, and Wikidata IDs). The geometry never ships (decision 41). This is a new source from the Theographic repository (CC BY-SA 4.0), added to `download` and `docs/licences.md` by ticket #10. Reason: it links 1,255 of 1,298 places, while a name and verse match leaves 36 unmatched and 15 ties.
57. **OpenBible points computed from OpenStreetMap geometry are dropped and re-sourced.** These are points whose record has `geometry_credit` "osm", even when `coordinates_source` is not "osm" (45 Genesis places, such as the Euphrates and Ur). Reason: the OpenStreetMap record already rejects converted or shifted OpenStreetMap values as still derived. A point computed from the geometry is the same case.
58. **The decision 43 check also applies to OpenBible points that come from Wikidata.** A point whose Wikidata coordinate cites OpenStreetMap is dropped and re-sourced. Reason: CC0 on Wikidata does not clean ODbL data, whoever looks it up.
59. **Nave's references to a whole chapter are skipped and reported.** Reason: a chapter is weak evidence that every verse in it is about the topic. FILED_UNDER stays verse precise (8,267 Genesis links).
60. **OpenBible confidence is `score.time_total` of the identification that gives the point.** Reason: the readme uses it to sort identifications. It is a number from 0 to 1,000; the front end can bucket it.
61. **A Nave's heading with only "See" lines is not a Theme.** Reason: it has no Verses, so it would have no Neighbours.

## 2026-10-19: Entity names (#4)

62. **A Person's or Place's `name` is Theographic's `displayTitle`, not its `name`.** Reason: `displayTitle` tells apart people with the same name ("Abimelech (King of Gerar)"), and Theographic's `name` for Jacob (`israel_682`) is "Israel", while `displayTitle` is "Jacob (Israel)". A Person's `aliases` come from `alsoCalled`. Events keep `title`; People Groups use `groupName`.

## 2026-10-19: Search index and credits (#5)

63. **Search index entries carry no `source` or `licence`.** Each entry is a label (ID, type, name, aliases) for an Entity whose file already carries them, so the provenance test skips `search-index.json`. Reason: repeating them on every entry adds size to the file the front end loads first, and the index is not a node or an edge.
64. **The build stops when it reads a source that has no credit in `pipeline/credits.py`.** Easton's is credited as its own source whenever a Dictionary Entry ships. Reason: the credits file must list every source the build read (PRD 5, rule 6), so a new source cannot ship without its credit wording and link.
65. **A Place's `aliases` are Theographic's `aliases`, its `kjvName`, and the `displayTitle` of each of its `otherNames` places.** An alias that equals the Place's name, ignoring case, is left out. Reason: the owner wants a search for "Luz" to find Bethel. Luz is not in Bethel's `aliases` or `kjvName`; Theographic links the two only through `otherNames` (181 places, 257 links). Luz stays its own Place (decision 7). Some upstream aliases are poor (Mount of Olives `mount_of_olives_828` has `4b is just "mount" or "mountain"`); fix them through the curated tables, not in code.

## 2026-10-19: OpenBible coordinates (#10)

66. **A Place that Theographic links to more than one OpenBible record gets no OpenBible point.** The no-coordinate report lists it with both records. Reason: 3 places link to two records (`ether_418`, `kartan_672`, `kiriathaim_696`; none in Genesis), and nothing in the data says which one is meant. Picking one would choose an identification, not just a source.
67. **Confidence ships as OpenBible gives it, negative values included.** Decision 60 calls `score.time_total` a number from 0 to 1,000, but it can be below 0: Dinhabah (`dinhabah_337`) has -77. Reason: a negative value means current scholarship leans against the identification. The front end can bucket it with the rest.

## 2026-10-19: Explicit relationship edges (#6)

68. **An Entity Neighbour is `{id, type, weight, edges}`, and each item of `edges` is `{edge, direction, source, licence}`, with `role` (father or mother) on PARENT_OF.** `direction` is read from the Entity whose file holds it: `out` when that Entity is the edge's source, `in` when the Neighbour is, `both` for SIBLING_OF, HALF_SIBLING_OF, and PARTNER_OF. The `edges` list is the combined edge type of the prototype. Explicit edges have weight 0 until CO_MENTION (#8) adds one. Reason: when a pair has several edges (Haran was born and died in Ur), each keeps its own direction, role, and source, and later curated edges (#7) can carry their evidence on the edge itself. The provenance test checks each edge, not the Neighbour.
69. **The PARENT_OF role comes from the parent's gender.** On real data this always matches the `father` and `mother` fields, and it also covers the one link only in `children` (Simon Iscariot and Judas). Reason: one rule, and a gender correction (Anah, #7) changes the role with it, as long as corrections run before the edges step.
70. **A "missing or unclear source" is a link to a record that is not in Theographic.** Such edges are dropped and listed in `dropped_edges.tsv`. Reason: every other edge comes from a named Theographic field, so its source is clear. Real data has none. The same report also lists edges dropped because their other end is outside the range (decision 51, amended).

## 2026-10-19: Cross-references and chapter Ring 2 (#9)

71. **A Verse's Ring 1 in its chapter file (`cross_references`) holds every Verse that a cross-reference links it to, sorted by weight.** Each is one Neighbour (decision 74). Reason: the front end needs them all for Overflow lists and the Votes filter, and Genesis fits (the largest chapter file is far below 500 KB).
72. **The chapter Ring 2 sidecar (`{chapter}.ring2.json`) is keyed by the Verse Key of each Verse Neighbour in the chapter's Ring 1.** Each key holds that Verse's top 10 Verse Neighbours as `{id, weight}`, with the weight of decision 74. A range counts at its first verse (decision 52). The file names `source` and `licence` once, so the provenance test skips `{id, weight}` entries. Entities in a Verse's Ring 1 have no Ring 2 here yet: their top Neighbours depend on CO_MENTION and ranking (#8). Reason: keying by Ring 1 node, not by Verse, stores each node once per chapter, and 10 lets the browser filter and still show 3 (PRD 10.4).
73. **A file over the size limit is trimmed, never split.** The build drops the fewest lowest weight Verse Neighbours (or Ring 2 entries) that bring it under the limit, and lists it in `split_or_trimmed.tsv` with the number dropped and the lowest weight kept. A file that stays over the limit with no cross-references is left whole and reported. The limit is the config value `size_limit`, 500 KB unless set; tests lower it to trim small fixture files. Reason: trimming needs no extra file names for the front end to find, and no Genesis file needs it.
74. **A Verse pair with cross-references in both directions is one Neighbour (owner, 2026-10-19).** A Verse Neighbour has the shape of an Entity Neighbour (ticket #6): `{id, type: "verse", weight, edges}`. Each item of `edges` is one OpenBible row: `{edge: "CROSS_REF", direction, votes, source, licence}`, plus `to_end_key` for a range. `direction` is `out` when the Verse whose file holds it is OpenBible's From verse, `in` otherwise. The weight is the higher Votes of its edges. No Verse appears twice in a Ring 1 or a Ring 2 list. Reason: one shape for every Neighbour, no duplicate nodes in the scene, and every row keeps its own Votes.

## 2026-10-19: Co-mention and entity Ring 2 (#8)

75. **Co-mention and ranking run in memory; the build still has no SQLite store (decision 48).** Reason: Co-mention needs no graph queries. One pass counts the Entity pairs in each Verse (2,063 pairs in Genesis), and every other step sorts one Entity's own Neighbours. The full Genesis build takes about 2 seconds. Look again at M6 if the whole Bible is too slow or too large for memory.
76. **A Co-mention is one item in a Neighbour's `edges`: `{edge: "CO_MENTION", direction: "both", shared_verses, source, licence}`.** Its weight, the cosine score rounded to 4 decimal places, becomes the Neighbour's weight, also when the pair has explicit edges; a Neighbour with explicit edges only keeps weight 0. Source and licence come from the Verse links of both Entities (Theographic now; Nave's too once Themes add Filed Under Verses). Each entity file also holds `overflow`, the number of Neighbours of each type beyond the default K of 6 (Verses included), and `ring2`, keyed by each Ring 1 node at K = 6 (an Entity ID or a Verse Key), with its top 10 Neighbours as `{id, weight}`. Reason: the shape of decisions 68 and 74, and the spec's static export section.
77. **The Ring 2 of an Entity holds its top Entity Neighbours, never its Verses. The Ring 2 of a Verse holds its top cross-referenced Verses.** Reason: the weight of a Verse Neighbour (the number of other Entities in it) and the cosine score are on different scales (decision 33). In one list, almost every Verse would rank above every Co-mention, and the 10 stored entries would be mostly Verses.

## Record: OpenStreetMap coordinates (2026-10-18)

**Context.** The dataset is released under CC BY-SA 4.0, because Theographic is CC BY-SA. Some OpenBible.info geocoding data comes from OpenStreetMap, which uses ODbL 1.0. Both licences are share-alike. Neither one lists the other as compatible. A dataset derived from both cannot meet both licences. The ODbL parts are 51 locations with `coordinates_source.type` "osm" and all precise and local geometry. The build also drops 11 points from a commercial source, whose licence is not stated (61 locations in all; one is in both groups).

**Decision.** The build drops these coordinates. It looks up the same places in Pleiades (CC BY), then Wikidata (CC0), then GeoNames (CC BY 4.0). Each coordinate records its source. Places with no match go to the "no coordinates" report.

**Options not taken.**
- Convert, round, or shift the OpenStreetMap values. Rejected: the result is still derived from ODbL data. UK database right also covers extraction.
- Ship a separate ODbL file and join it in the browser. Rejected: a second licence and more front end code for 51 places.
- Treat the 51 points as an "insubstantial" extract. Rejected: it depends on guidance we have not checked, and it does not cover the geometry.

**Note.** The readme states that OpenStreetMap data is ODbL 1.0. It does not state which fields hold OpenStreetMap data; that mapping is our reading (corrected 2026-10-19, see `docs/licences.md`, section 4). This is not legal advice.
