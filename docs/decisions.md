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

## Record: OpenStreetMap coordinates (2026-10-18)

**Context.** The dataset is released under CC BY-SA 4.0, because Theographic is CC BY-SA. Some OpenBible.info geocoding data comes from OpenStreetMap, which uses ODbL 1.0. Both licences are share-alike. Neither one lists the other as compatible. A dataset derived from both cannot meet both licences. The ODbL parts are 51 locations with `coordinates_source.type` "osm", all precise and local geometry, and 11 points from a commercial source.

**Decision.** The build drops these coordinates. It looks up the same places in Pleiades (CC BY), then Wikidata (CC0), then GeoNames (CC BY 4.0). Each coordinate records its source. Places with no match go to the "no coordinates" report.

**Options not taken.**
- Convert, round, or shift the OpenStreetMap values. Rejected: the result is still derived from ODbL data. UK database right also covers extraction.
- Ship a separate ODbL file and join it in the browser. Rejected: a second licence and more front end code for 51 places.
- Treat the 51 points as an "insubstantial" extract. Rejected: it depends on guidance we have not checked, and it does not cover the geometry.

**Note.** The split between the CC BY parts and the ODbL parts is our reading of the OpenBible readme. The readme does not state it. Record this in `docs/licences.md` in M0. This is not legal advice.
