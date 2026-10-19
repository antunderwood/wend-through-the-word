# PRD: Wend Through the Word

Status: Draft 5 (adds the focus model prototype findings and correction requests; see `docs/prototypes/focus-model.md` and decisions 24 to 34 in `docs/decisions.md`)
Date: 2026-10-19
Owner: Ant

## 1. Purpose

Build a free web application. The application shows the Bible as an interactive 3D graph. A user starts at a verse, a person, a place, an event, or a theme. The user then moves along the links to related items.

The data comes from open sources. The data is stored in a graph model. The graph is served from Cloudflare at no cost.

`GLOSSARY.md` defines the domain terms used in this document, such as Entity, Focus, Ring 1, and Co-mention.

## 2. Goals

1. Show the Bible text in a modern, readable translation.
2. Link verses to people, places, events, people groups, and themes.
3. Link verses to other verses (cross-references).
4. Show the links as an animated 3D graph that the user can explore.
5. Show a plain text view of every node, so a user can read without the graph.
6. Run on the Cloudflare free tier.
7. Support the whole Bible. Build the Genesis prototype first.
8. Let readers request corrections to the data, with a verse as evidence (section 10.5).

## 3. Non-goals for version 1

- User accounts, notes, or saved views.
- Original language word study (Hebrew and Greek). This is phase 2.
- Commentary text.
- Storage of copyrighted translation text.
- Native mobile apps.
- AI generated content shown as fact.
- Any Worker code. Version 1 is static files only. The NLT display, D1, and KV move to phase 2.
- Birth and death years for people. Only 70 of 3,067 Theographic people have them.
- Original summaries for entities. The app shows Easton's Dictionary Entry only.

## 4. Users

- Bible readers who want to see how items connect.
- Students who study a person, a place, or a theme.
- Teachers who need a visual aid.

The application is free and public. It has no revenue plan.

Expected traffic: a few tens of visitors a day at most. The application stays on the Cloudflare free tier at launch.

Release order: desktop first, then mobile.

## 5. Licence rules

These rules are fixed for version 1.

1. The application is free. CC BY-SA data is allowed.
2. The combined dataset is released under CC BY-SA 4.0.
3. Every node and every edge has a `source` field and a `licence` field.
4. Do not use any CC BY-NC source. Examples: ETCBC BHSA, STEPBible TTESV.
5. Do not store the text of a copyrighted translation. Fetch it live and show it only.
6. A credits page lists every source, its licence, and its link.
7. Read the LICENSE file of each repository before ingest. Record the result in `docs/licences.md`.
8. Do not ship ODbL data. OpenBible.info coordinates that come from OpenStreetMap, from a commercial source, or from Google are dropped. Theographic's own coordinate fields never ship. The build looks these places up again in Pleiades, then Wikidata, then GeoNames. Each coordinate records its own source.
9. Do not ship raw TIPNR data. TIPNR is used only as a build-time check (section 9).

## 6. Data sources

### 6.1 Core sources for the prototype

| Source | Use | Licence | Format | Where |
|---|---|---|---|---|
| Berean Standard Bible (BSB) | Main text | CC0 | Text, JSON, SQLite | berean.bible; scrollmapper/bible_databases; bible.helloao.org |
| Theographic Bible Metadata | People, places, events, people groups, verse links, family links, Easton's text (`dictText`). Identity authority for entities. It has no periods table. | CC BY-SA 4.0 | JSON, CSV, Neo4j dump | github.com/robertrouse/theographic-bible-metadata |
| OpenBible.info cross-references | Verse to verse edges, with vote scores | CC BY 4.0 | Tab separated text in zip | openbible.info/labs/cross-references |
| OpenBible.info geocoding | Place coordinates and confidence. CC BY points only (section 5, rule 8). | CC BY 4.0 (OpenStreetMap parts: ODbL, not used) | JSON lines, GeoJSON | github.com/openbibleinfo/Bible-Geocoding-Data |
| Pleiades, Wikidata, GeoNames | Replacement coordinates for the places whose OpenBible point came from OpenStreetMap | CC BY 3.0, CC0, CC BY 4.0 | Various | pleiades.stoa.org; wikidata.org; geonames.org |
| STEPBible TIPNR | Build-time check of identity and family links. Nothing ships. | CC BY 4.0 (asks that the file is not reposted) | Tab separated text | github.com/STEPBible/STEPBible-Data |
| Nave's Topical Bible | Themes and Filed Under links. Headings that are people or places are removed. | Dataset CC BY 4.0 (LICENSE and README) | CSV | github.com/BradyStephenson/bible-data; alternative: github.com/neuu-org/bible-topics-dataset |
| Easton's Bible Dictionary | Dictionary Entry for entities, taken from Theographic `dictText` | Public domain (1897 text; decision 38) | JSON | Through Theographic |

### 6.2 Optional sources (phase 2)

| Source | Use | Licence |
|---|---|---|
| API.Bible or Tyndale NLT API (api.nlt.to) | Live NLT display through a Worker, with a KV cache | Non-commercial terms. NLT on the API.Bible free tier is unverified. |
| World English Bible | Second free text | Public domain |
| Tyndale Open Bible Dictionary | Modern article text | CC BY-SA 4.0 |
| Macula Hebrew and Greek | Word level links | CC BY 4.0 |
| ACAI | Word to entity tags | CC BY-SA 4.0 |
| STEPBible TIPNR | Strong's numbers for people and places | CC BY 4.0 |
| STEPBible TAHOT, TAGNT, lexicons | Word study | CC BY 4.0 |
| UBS open licence data | Plants, animals, objects, routes | CC BY-SA 4.0 |
| Wikidata | Outward links (QIDs) | CC0 |

### 6.3 Live display only

None in version 1. The NLT display is phase 2 (section 6.2). The application must work fully without it.

## 7. Data model

### 7.1 Identifiers

- Verse key: an integer in the form `BBCCCVVV`. Example: `01001001` is Genesis 1:1. It is Theographic's `verseID`.
- Verse label: OSIS form. Example: `Gen.1.1`.
- Entity ID: the Theographic ID, with a prefix for the type. Example: `person:abel_13`.
- Strong's number: the join key for lexicon data in phase 2.
- Wikidata QID: an optional attribute.

All sources use English verse numbering. The BSB and Theographic (KJV) have the same 31,102 verse keys. There is no mapping table. The build applies a short list of exceptions:

1. OpenBible cites `3John.1.15`. Map it to `3John.1.14`.
2. Sixteen BSB verses have no text, for example Matt 17:21. Keep the key. Mark the verse "no BSB text".
3. Rev 12:17 ends at a different point in the BSB and the KJV. Note it. Do not change it.
4. The BSB puts Psalm titles in verse 1. Note it. Do not change it.

The mismatch report still runs over every source.

### 7.2 Node types

| Type | Key fields |
|---|---|
| Verse | key, label, book, chapter, verse, text_bsb |
| Person | id, name, aliases, gender, dictionary_entry, source, licence |
| Place | id, name, lat, lon, confidence, coord_source, dictionary_entry, source, licence |
| Event | id, title, event_year, dictionary_entry, source, licence |
| People Group | id, name, dictionary_entry, source, licence |
| Theme | id, name, source, licence |

Person, Place, Event, People Group, and Theme are all Entities. Verse is not an Entity. Book is not a node. The book filter uses the verse key.

`dictionary_entry` is Easton's text from Theographic `dictText`. Do not use `dictionaryText`: it has broken characters. The interface always labels it "Easton's Bible Dictionary (1897)". Many entities have none.

Event years follow the chronology of Floyd Nolen Jones. The interface shows them as "approx., Jones chronology". Theographic stores years in astronomical numbering since October 2026 (4004 BC is -4003). Convert with care.

### 7.3 Edge types

| Edge | From | To | Fields |
|---|---|---|---|
| CROSS_REF | Verse | Verse | votes, source |
| MENTIONS | Verse | Person, Place, Event, People Group | source |
| FILED_UNDER | Verse | Theme | source |
| CO_MENTION | Entity | Entity | weight, shared_verses (derived by the build) |
| PARENT_OF | Person | Person | role (father or mother), source |
| PARTNER_OF | Person | Person | source |
| SPOUSE_OF | Person (man) | Person (woman) | source, evidence (verse) |
| CONCUBINE_OF | Person (man) | Person (woman) | source, evidence (verse) |
| POSSIBLY_SAME_AS | Person | Person | source, evidence (verses), note |
| SIBLING_OF | Person | Person | source |
| HALF_SIBLING_OF | Person | Person | source (only when Theographic gives it; not derived) |
| PARTICIPATED_IN | Person | Event | source |
| OCCURRED_AT | Event | Place | source |
| BORN_AT, DIED_AT | Person | Place | source |
| MEMBER_OF | Person | People Group | source |

Edges with a missing or unclear source are not loaded.

CO_MENTION links two Entities that share at least one verse through MENTIONS or FILED_UNDER. Its weight is the cosine score: shared verses divided by the square root of (verses of A times verses of B), counted across the whole Bible (decision 92). Raw counts make God (8,587 verses) the top neighbour of almost everyone. With cosine, Abraham's top neighbours are Isaac, Sarah, Heth, Abimelech, Nahor, and Lot (checked on Theographic data, 2026-10-18).

## 8. Architecture

Cloudflare has no native graph database. The graph is small. Use a static first design.

```
Python build pipeline (offline)
  -> SQLite file (full graph)
  -> Static JSON export (chapter files, entity files)
  -> Cloudflare Workers static assets for static files (no Worker script)
  -> Web application (3D graph + text panels, search in the browser)

Phase 2 may add a Worker, D1, and KV (section 8.3).
```

### 8.1 Sizes (expected, to confirm in the build)

| Item | Count |
|---|---|
| Verses | about 31,000 |
| Entities (Theographic) | 4,838: 3,067 people, 1,298 places, 450 events, 23 people groups |
| Themes | not yet counted (Nave's has about 5,300 headings before filtering) |
| Entity to verse links | about 53,000 |
| Cross-references | 344,799 |

### 8.2 Static file layout

```
/data/index.json                 book list, counts, build date, licences
/data/chapter/{book}/{chapter}.json        verses, Ring 1 for each verse (entity links, top cross-references)
/data/chapter/{book}/{chapter}.ring2.json  Ring 2 for each verse, split by the size rule below
/data/entity/{type}/{id}.json    entity facts, Ring 1 neighbours sorted by weight, Overflow counts for each type, and the top 10 neighbours of each Ring 1 node (see section 10.4)
/data/credits.json               source list for the credits page
/data/search-index.json          names, aliases, types, and IDs of entities (themes included), plus the book and chapter list. It is also the label lookup for Ring 2 nodes.
```

Each file must be below 500 KB uncompressed. If a file is larger, the build splits it or trims the lowest vote cross-references.

Ring 2 entries hold an ID and a weight only. Labels come from `search-index.json`.

There are no per-verse files. 31,102 files would pass the free limit of 20,000 files.

### 8.3 Worker endpoints (phase 2)

Version 1 has no Worker script. Search runs in the browser. Static files serve the graph. This section applies only when phase 2 adds a Worker.

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/nlt?ref=` | Live NLT passage through API.Bible, with KV cache | Optional |
| `GET /api/neighbours?id=&hops=&min_votes=` | Dynamic neighbour query on D1 (limit: 2 hops) | Phase 2. Build it only if static files are not enough. |

Rules:

1. Limit every response to 500 nodes. Return a `truncated` flag when the limit applies.
2. Set cache headers on every Worker response. Cache hits use no CPU time, but they still count as requests.
3. Return a clear error code when a limit is reached. The front end shows a message. The static graph keeps working.
4. Use an index for every D1 query. Test each query with `EXPLAIN QUERY PLAN`. One full scan of the cross-reference table (about 340,000 rows) uses about 7% of the daily read quota.
5. Do not add a Worker call to the default user path without owner approval.

### 8.4 Cloudflare free tier limits

Checked on 2026-10-17 against the Cloudflare documentation. Check again before launch, because Cloudflare changes these values.

| Item | Free limit | Source |
|---|---|---|
| Workers requests | 100,000 per day (resets at 00:00 UTC) | developers.cloudflare.com/workers/platform/limits |
| Workers burst rate | 1,000 requests per minute | developers.cloudflare.com/workers/about/limits |
| Workers CPU time | 10 ms for each request | developers.cloudflare.com/workers/platform/limits |
| Workers subrequests | 50 for each request | developers.cloudflare.com/workers/about/limits |
| Static asset requests | Free and unlimited | developers.cloudflare.com/workers/about/pricing |
| Static asset files | 20,000 for each Worker version; 25 MiB for each file (checked 2026-10-19) | developers.cloudflare.com/workers/platform/limits#static-assets |
| D1 rows read | 5 million per day | developers.cloudflare.com/d1/platform/pricing |
| D1 rows written | 100,000 per day | developers.cloudflare.com/d1/platform/pricing |
| D1 storage | 5 GB in total, for all databases | developers.cloudflare.com/d1/platform/pricing |

Since 1 September 2026, D1 queries fail when the account passes a daily limit. They fail until 00:00 UTC. Stored data is not affected. Cloudflare sends an email alert when a limit is reached.

A D1 read counts every row that a query scans. The size of the row does not matter.

These values were checked on the official pages on 2026-10-19 (`docs/licences.md`, section 6).

| Item | Free limit |
|---|---|
| KV reads | 100,000 per day |
| KV writes | 1,000 per day (no rise is shown on the official pages) |
| R2 storage | 10 GB-month |
| R2 operations | 1 million Class A and 10 million Class B per month |
| R2 egress | No fee |
| Workers Paid plan | About USD 5 per month. It removes the Worker and D1 daily limits. |

### 8.5 Cloudflare design rules

1. **Static first.** Serve all graph data as static files. They do not count against the daily Worker requests.
2. **Search in the browser.** The build makes `search-index.json`. It holds names, aliases, types, and IDs for entities and themes. Target size: under 500 KB compressed. Verse reference lookup (for example `Gen 1:1`) runs in the browser. Full text search of verse text is phase 2.
3. **No D1 in version 1.** Use D1 only for phase 2 features that static files cannot do.
4. **Large D1 loads.** The cross-reference table has about 340,000 rows. The free write limit is 100,000 rows per day. A full load needs at least 4 days of free quota. It is not verified whether a bulk import counts as writes. Test this with Genesis. Either load in batches of 1,000 rows over several days, or use the paid plan for one month.
5. **NLT cache (phase 2).** The KV write limit is low (1,000 per day, unconfirmed). Cache each passage once. Respect the 30-day refresh rule from API.Bible.
6. **Cache headers for data files.** Put a version or hash in each data file name. Use long cache times. The `index.json` file holds the current version and uses a short cache time.
7. **Compression.** Check that Cloudflare serves the JSON files compressed. Do not assume it.
8. **Static asset limits.** The free plan allows 20,000 files and 25 MiB for each file (checked 2026-10-18). The whole Bible needs about 7,000 to 12,000 files (1,189 chapters, their Ring 2 files, about 4,800 entities, and themes). Recheck before launch.
9. **Configuration in the repository.** Keep the Wrangler configuration file in the repository. A deploy must run from one command.
10. **Monitoring.** Check the Workers and D1 usage dashboards each week after launch. Act when usage passes 50% of a daily limit.
11. **Free tier first.** The application stays on the free tier at launch. The Workers Paid plan is the later upgrade path. The owner decides when.

## 9. Build pipeline (Python)

Use Python. Use standard tools first. Use Rust only if a step is too slow and the owner agrees.

Suggested layout:

```
pipeline/
  config.py            book range, paths, versions
  download.py          fetch sources, record checksums
  ingest_bsb.py
  ingest_theographic.py
  ingest_crossrefs.py
  ingest_geocoding.py
  resource_coords.py   replace OpenStreetMap coordinates (Pleiades, Wikidata, GeoNames)
  ingest_themes.py     Nave's headings, minus people and places
  verse_exceptions.py  the exception list in section 7.1
  co_mention.py        derived CO_MENTION edges with cosine weight
  check_tipnr.py       match TIPNR to Theographic by verse overlap; report disagreements
  validate.py          checks (section 12)
  curated/             owner-reviewed tables, each row with an evidence verse and a reviewed flag:
    partners.csv       spouse, concubine, partner, or none for each Theographic partner pair
    possibly_same.csv  POSSIBLY_SAME_AS links (people a tradition reads as one person)
    corrections.csv    fixes to Theographic attributes, for example gender; `was` holds the upstream value the fix replaces
                       every curated table has a `request` column: the URL of the correction request, or empty
  export_static.py     write JSON files
docs/licences.md
tests/
```

Rules:

1. The book range is a config value. Do not write Genesis only logic.
2. Every step is repeatable. The same input gives the same output.
3. Every download records the source URL, the date, and a SHA-256 checksum.
4. Every mismatch goes to a report file. Do not drop data without a record.
5. Run `ruff` and `pytest` in the continuous integration job.

## 10. Front end requirements

Release order: desktop first, then mobile. The desktop release uses a mouse and a keyboard. The mobile release adds touch controls, a lower node limit, and a layout for a narrow screen. Write the layout code so that the mobile release needs no rewrite.

### 10.1 Views

1. **Graph view:** A 3D force directed graph. The centre node is the current focus. The view shows its neighbours.
2. **Reader panel:** The BSB text of the selected chapter. A click on a verse selects it. A double click sets it as the focus.
3. **Detail panel:** The Dictionary Entry (when there is one) and facts for the selected node, with a list of linked verses.
4. **Search box:** Finds an entity, a theme, or a verse reference. Search runs in the browser over `/data/search-index.json`. It matches names and aliases only. Verse text search is phase 2.
5. **Filter panel:** Node type toggles, a minimum vote slider for cross-references, and a book filter. The filters apply in the browser to the data already loaded. The vote slider has a short explanation beside it: "Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength." With an entity as the focus, the slider says that it only changes ring 2.
6. **Credits page:** All sources and licences.

### 10.2 Behaviour

1. A click on a node selects it. The detail panel shows the selected node. The scene does not change.
2. A double click on a node, or the "Make focus" button in the detail panel, makes it the focus. The graph loads its neighbours.
3. The detail panel has Prev and Next buttons. They step the selection along your path. They do not change the focus.
4. Node colour shows node type. Node size shows the number of links.
5. The graph uses a smooth animation when the focus changes.
6. A user can turn off animation. The application also respects the `prefers-reduced-motion` setting.
7. The URL holds the current focus and filters. A user can share the URL.
8. A 2D fallback list shows the same neighbours. It is used on devices without WebGL.
9. Entity pages can be read without WebGL. Add basic accessibility: keyboard focus, text labels, and colour contrast.

### 10.3 Technology (decided)

- TypeScript.
- Svelte 5 with Vite. Do not use SvelteKit in version 1.
- `3d-force-graph` (Three.js and WebGL) for the 3D graph view. Use it directly, with no wrapper library.
- Cloudflare Workers static assets for hosting.

Rules:

1. Write the graph code as its own module. The module does not import Svelte. Its interface is `setFocus`, `setFilters`, and `onNodeClick`.
2. Svelte 5 uses a reactivity model called runes. Many older examples show the old model. Check every example against the Svelte 5 documentation.
3. Keep the graph data object stable. Do not create a new data object when only the view state changes. A new data object can restart the force simulation.
4. The M3 node limit test page may use plain TypeScript. Add Svelte for the panels at M4.

### 10.4 Visual design and disclosure rules (decided)

The look must be modern. Do not use the default ball-and-stick style of a force graph. The user sees a focus node and its nearby connections. Other nodes become visible only when needed.

Decisions:

1. Moving the focus replaces the view. A click only selects a node (section 10.2).
2. The view uses limited tilt (2.5D) by default. Whether a mouse drag may still orbit in full 3D is decided in the M3 navigation prototype. The focus model prototype suggests full 3D is likely confusing (`docs/prototypes/focus-model.md`).
3. The dark theme comes first. The light theme is later.

#### Disclosure rings

| Ring | Content | Display |
|---|---|---|
| Focus | The selected node | Full size, with a label and the first line of its Dictionary Entry |
| Ring 1 | Direct neighbours, the top K by weight | Full labels |
| Ring 2 | Up to 3 neighbours of each ring 1 node, after filters (about 108 at most) | Faint and small, with no labels. They show the shape of the graph. |
| Your path | Every focus node of the session; the scene draws the last 5 | Small and dim, joined by one path line to the focus |
| Pinned | Up to 3 nodes chosen by the user, each with its top 3 neighbours of each type (no ring 2) | Normal size. Shared nodes (linked to the focus and a pin) are highlighted. |
| Hidden | All other nodes | Not drawn |

Rules:

1. Show the top K neighbours of each type. The default K is 6. Tune K in M3.
2. The weight is the cross-reference vote score for verse to verse links, and the CO_MENTION cosine score for entity to entity links. Neighbours of one type rank by weight alone. An explicit edge (for example PARENT_OF) is a label, not a priority (decision 91). For an entity focus, verse neighbours rank by the number of other entities in the verse. This is a heuristic.
3. Put the remaining neighbours of one type into one Overflow Node, for example "+42 places". A click on it lists those neighbours in the detail panel. It never adds nodes to the scene. A click on a list item selects it. A double click makes it the focus.
4. A hover over a ring 2 node shows its label and its path to the focus node. The node returns to faint when the pointer leaves.
5. When a node becomes the new focus, the old focus joins your path. The old ring 1 fades out. New nodes grow out of the clicked node.
6. Your path holds every focus node of the session, each node once (the latest visit counts). The scene draws only the last 5, as small dim nodes on one path line to the focus. The breadcrumb row and Prev and Next cover the whole path; the row scrolls and shows the newest first. A click on either selects that node. Prev and Next in the detail panel step along your path. "Make focus" on a trail node goes back to it.
7. A user can pin up to 3 nodes. A pinned node stays in the view when the focus changes. It brings its top 3 neighbours of each type, with no ring 2. Nodes in ring 1 or around a pin that link to both the focus and a pin are highlighted as shared. Use this to compare nodes.
8. The scene never shows more nodes than the node limit from the M3 test. Nodes on your path, pinned nodes, and the neighbours around pins, count toward the limit. Trim ring 2 first, then the oldest nodes on your path, then the neighbours around pins. Never trim the focus, pinned nodes, ring 1, or overflow nodes. Within ring 2, and within the neighbours around pins, trim round robin: every parent's third neighbour goes before any second, and every second before any first. Within a round, the parent ranked lowest in its type list loses first. Do not compare weights across types. When nodes are trimmed, a quiet note in a corner of the scene says how many, for example "39 faint nodes hidden to keep the view fast".
9. Test the rules first with hub nodes that have thousands of links, for example Jesus and Jerusalem.

#### Node look

1. Do not use spheres. Use flat shapes that always face the camera, such as a rounded card, or a disc with an icon and a label.
2. Use one icon and one muted colour for each node type: person, place, event, people group, theme, and verse. Use one accent colour for the focus node.
3. Use a small range of node sizes. Size shows importance.
4. Labels follow distance. Near nodes show full labels. Far nodes show no label.
5. A verse node shows a short quote from the BSB, not only the reference.
6. Use a soft glow on the focus node and depth fog on far nodes. Check the post-processing options of the library in M3. The exact API is not verified. Test the cost on a mid-range laptop.

#### Edge look

1. Use thin, slightly curved lines with low opacity.
2. Edges that touch the focus node or the hovered node use full opacity.
3. Use one muted colour for each edge type, or a gradient between the two end nodes.
4. Show moving particles on the focus node edges only, to show direction (for example "parent of").
5. Show only cross-reference edges above the vote threshold. Fade the others out.
6. Edges that touch the focus carry a text label at their midpoint. Other edges show their label on hover only.
7. The label is the relationship read from the focus: father, mother, son, daughter, brother, sister, half-brother, half-sister, partner, birthplace, took part, member of. Family words follow the neighbour's gender. Unknown gender uses parent, child, or sibling. Theographic's `partners` field does not separate wives from concubines, so a curated table (`pipeline/curated/partners.csv`) decides. The label is husband or wife when a BSB verse calls them so. It is concubine (read from the man) when a verse calls her that; read from her, he is "partner" (or "husband" when a verse also says wife). When the text uses both words, both are shown, for example Hagar, Keturah, and Bilhah: "wife, concubine". It is partner when no verse says either. Each curated row has an evidence verse, shown in the detail panel. The owner reviews every row before it ships.
8. A link that is only a co-mention is a dashed line labelled "together in N verses".
9. The build must keep the direction of PARENT_OF, BORN_AT, DIED_AT, PARTICIPATED_IN, OCCURRED_AT, and MEMBER_OF.

#### Layout

1. Pin the focus node at the centre.
2. Place ring 1 nodes in sectors by type around the focus node. A user then learns where to look for each type.
3. Let ring 2 nodes drift outward on a weak force.
4. Keep node positions stable between focus changes. Fix the ring 1 positions during a transition, so the force engine does not fight the animation.

#### Page design

1. Use translucent panels over the graph for the reader and detail views.
2. Use a serif font for scripture text. Use a clean sans font for the interface.
3. The camera flies to the new focus in about 600 to 800 ms with easing. Turn this off when the `prefers-reduced-motion` setting is on.
4. Use large type and wide spacing. Do not use dense toolbars.
5. Keyboard control: arrow keys move between ring 1 nodes, Enter sets the focus, and Backspace goes back.

#### Data needed from the build

Each entity file lists its neighbours, sorted by weight. Each neighbour has an ID, a type, an edge type, and a weight value. The build also writes the overflow counts for each type, for the Overflow Nodes. For each ring 1 node, the file holds its top 10 neighbours. The browser filters these and shows 3 as ring 2.

### 10.5 Correction requests

The data has errors. Readers can ask for a correction. The owner reviews each request. Version 1 stays static: there is no form on the site.

**Channel**

1. The primary channel is a GitHub Issue Form ("Correction request") in the public repository.
2. The fallback is email to a project-only address (not a personal address). The owner copies each email into a GitHub issue without the sender's name or address, then deletes the email. The page says this before the reader writes.
3. Both channels state: "By submitting, you agree that your suggestion may be included in the dataset under CC BY-SA 4.0."

**Entry points**

1. The detail panel has a "Suggest a correction" button for the selected node.
2. Each relationship, fact, and linked verse in the detail panel has a small "Suggest a correction" link.
3. The link opens the issue form with these fields filled in: the node IDs, the current label or value, the data version (from `index.json`), and the page URL. The reader adds the correction and at least one evidence verse.
4. The email link uses the same text in a `mailto:` body.

**Scope**

| A reader can ask to correct | Examples |
|---|---|
| Relationships | A wrong or missing link or label: "Anah and Beeri are not partners", "Lot is Abraham's nephew" |
| Entity facts | Gender, name, aliases, place coordinates, Event Year, Possibly Same Person links |
| Verse links | A verse names someone but has no link (for example Gen 22:2 "God said"), or a link is wrong |

Source texts are out of scope. The BSB wording and Easton's articles are fixed public domain texts. The form says so and links to the BSB publisher for text issues.

**Rules**

1. Every request must cite at least one verse as evidence. No verse, no change.
2. The owner accepts or declines each request, with a short reason in the issue.
3. An accepted request becomes a row in a curated table (`pipeline/curated/`). Each row has a `request` column with the issue URL. Rows the owner adds without a request leave it empty.
4. When the request fixes a plain error in Theographic, the owner also opens an issue on the Theographic repository that links to ours. Editorial choices (the wife and concubine rule, Possibly Same Person links) stay local.
5. After each Theographic refresh, the build reports curated rows that are now redundant (upstream has the same fix) or that no longer match (an ID or value changed). It never applies a row that no longer matches.
6. The detail panel shows a corrected item with a note and a link, for example: "Corrected after review: gender (Gen 36:24). Request #12." The 3D scene shows no mark.

## 11. Performance targets

These are targets to test in the prototype. They are not proven.

| Item | Target |
|---|---|
| First view loads | under 3 seconds on a normal home network |
| Nodes in view (desktop) | up to 500, at least 30 frames per second |
| Nodes in view (phone, after the desktop release) | up to 150, at least 30 frames per second |
| Graph file size per view | under 500 KB |
| Search index file | under 500 KB compressed |
| Worker requests | 0 (version 1 has no Worker script) |

Test the node limit in a browser in the first week. If the targets fail, lower the node limit. Do not add features before this test.

## 12. Validation and acceptance (Genesis prototype)

The Genesis prototype is complete when all of these are true.

1. The BSB text for Genesis is loaded. Genesis has 50 chapters and 1,533 verses. The count matches.
2. Every Theographic verse link for Genesis has a BSB verse key, or it appears in the mismatch report. The exceptions in section 7.1 are applied and tested.
3. The mismatch report shows the count and the cause for each unmapped link.
4. Cross-references from Genesis verses load with a vote score. The default filter is a positive vote score.
5. Every node and every edge has a `source` and a `licence` field. A test checks this.
6. Place nodes have coordinates when OpenBible.info has a CC BY match, or when Pleiades, Wikidata, or GeoNames has one. No shipped coordinate comes from OpenStreetMap. A test checks this. The report lists places with no match.
7. The static export for Genesis is below the file size limit.
8. The web page shows a 3D graph for one Genesis person, for example Abraham. The page shows linked verses in the reader panel.
9. The page shows the node limit result for desktop and phone.
10. The credits page lists every source used.
11. The build runs from a clean checkout with one command.
12. The deploy has no Worker script. The graph, the reader panel, the detail panel, and search all work from static files.
13. Genesis themes from Nave's load as FILED_UNDER links. No theme has the name of a Theographic person or place. The report lists the removed headings.
14. The search index file is below the size limit. A search for "Abraham" returns the correct entity.
15. A focus view of one Genesis person shows the focus node, up to K neighbours of each type in ring 1, and faint ring 2 nodes. The remaining neighbours appear as Overflow Nodes. At the default K of 6, God is in the top 6 People of at most 10% of Genesis People (19 of 352 on 2026-10-19), and Abraham's top 6 People are Isaac, Sarah, Heth, Abimelech, Nahor, and Lot (decision 94).
16. A click on a node shows it in the detail panel and does not change the scene. A double click replaces the view, adds the old focus to your path in the scene, and keeps the pinned nodes. Prev and Next read along your path without moving the focus.
17. The TIPNR check report lists Genesis people where TIPNR and Theographic disagree on identity or family links.
18. The detail panel has "Suggest a correction" links. Each link opens the issue form with the node IDs, the current value, the data version, and the page URL filled in.
19. A corrected item shows its correction note, evidence verse, and request link in the detail panel.
20. The build reports curated rows that are redundant or no longer match after a source refresh. A test checks that a row that no longer matches is not applied.

## 13. Milestones

| Milestone | Content |
|---|---|
| M0 | GitHub repository (private until M5, decision 47) with the "Correction request" issue form, licence check, `docs/licences.md`, download script. |
| M1 | BSB, Theographic, and the verse exceptions for Genesis, with the mismatch report |
| M2 | Cross-references, geocoding with re-sourced coordinates, the TIPNR check, Nave's themes, CO_MENTION edges, and the static export for Genesis (spec: `docs/specs/genesis-data-build.md`) |
| M3 | A UI prototype of navigation in 2.5D (select, make focus, your path, pins, camera, orbit or not), building on `docs/prototypes/focus-model.md`. A minimal 3D page. Run the node limit test. Test the disclosure rings, the 2.5D tilt, and the node look from section 10.4 on hub nodes. |
| M4 | Reader panel, detail panel, search, filters, shareable URLs, and "Suggest a correction" links |
| M5 | Cloudflare deploy with static assets and browser search. No Worker script. The repository becomes public. |
| M6 | Run the pipeline for the whole Bible. Review data quality. |
| M7 | Mobile release: touch controls, a narrow layout, and the lower node limit |
| M8 | Phase 2 planning: word level links, a second text, modern dictionary text, the NLT display, and verse text search |

## 14. Risks

| Risk | Effect | Action |
|---|---|---|
| Theographic uses KJV verse numbering, not BSB | Wrong verse links | Low. The verse keys are identical (checked 2026-10-18). Apply the exceptions in section 7.1 and test them in M1. |
| Hub entities (God, Jesus, Israel) dominate every view | The same nodes in every ring 1 | Cosine weight for CO_MENTION. Test on Genesis in M3. |
| Event years follow one chronology (Jones) | Users read a contested date as fact | Label every year "approx., Jones chronology". Show no years for people. |
| Nave's headings overlap with Theographic people and places | Duplicate entities | Remove those headings in M2. Report them. |
| The cross-reference set has many weak links | A dense, unreadable graph | Filter by votes. Limit the number of edges for each node. |
| The 3D view is too slow with many nodes | Poor experience | Use focus views. Test early. Use the 2D fallback. |
| Share-alike data | The combined dataset must use CC BY-SA | Accepted for a free application. Show credits. |
| Unclear licence (Strong's data) | Legal risk | Ask the author or use another source. Record the decision. BradyStephenson/bible-data states CC BY 4.0 in its README (checked 2026-10-18). |
| OpenStreetMap data in OpenBible coordinates (ODbL) | Licence conflict with CC BY-SA | Drop those coordinates. Re-source from Pleiades, Wikidata, GeoNames. Changing the format does not remove ODbL. |
| NLT licence or API limits | Feature may not work | NLT is phase 2 and optional |
| Cloudflare free limits change | Hosting cost | Use static files. Check the limits before launch. |
| Theme data is old (Nave's, 19th century labels) | Weak theme layer | Use it as a seed. Plan a curated modern theme list. |
| Relationship types beyond family are sparse | Few links of type "fought against" or "travelled to" | Not in version 1. Use human reviewed extraction in a later phase. |
| Source network access from the build sandbox | Failed downloads | GitHub hosts most sources. If a host is blocked, the owner supplies the file. |
| The free Worker limit (100,000 requests per day) is reached | Worker errors for the rest of the UTC day | Static first design. No Worker call in a normal session. Error message in the front end. |
| D1 daily limits are reached (5 million reads, 100,000 writes) | D1 queries fail until 00:00 UTC | Use D1 for optional features only. Index every query. Load large tables in batches. |
| Static asset limits change | A deploy may fail | 20,000 files and 25 MiB for each file (checked 2026-10-18). Recheck before launch. |
| KV and R2 limits come from secondary sources | Wrong budget | Check the official pages in M0 |
| Readers without a GitHub account do not report errors | Fewer corrections | Email fallback to a project-only address |
| Correction requests are spam or opinion | Owner time | A verse is required. The owner can decline with a reason. |
| Email requests carry personal data | Privacy | Copy into GitHub without name or address. Delete the email. |
| A client side search index is too large | Slow first load | Index names and aliases only. Split the index by type if it passes 500 KB compressed. |

## 15. Open questions

1. Front end: Svelte 5 with Vite and TypeScript. (Decided.)
2. Target device: desktop first, then mobile. (Decided.)
3. Cloudflare account: the owner has one. (Decided.)
4. NLT: moved to phase 2. API.Bible free tier access is unverified; Tyndale's api.nlt.to is an alternative. (Deferred.)
5. Themes: Nave's headings, minus people and places, in M2. A curated modern list is later. (Decided.)
6. Application name: "Wend Through the Word". (Decided.)
7. Licence of the application code: MIT. (Decided.)
8. Expected traffic: a few tens of visitors a day at most. (Decided.)
9. Browser search over names and aliases in version 1. Verse text search in phase 2. (Decided.)
10. Paid plan: stay on the free tier at first. The owner decides on the paid plan later. (Decided.)
11. Visual references: decide from the node look prototype in M3. (Deferred.)
12. Does the owner want the whole-graph overview (cosmos.gl, 2D) in phase 2? The recommendation is yes, after M7. (Open.)
13. Which project-only email address receives correction requests? (Open.)

## 16. Instructions for Claude Code

1. Read this file in full before any work.
2. Start with M0 and M1. Do not write front end code before M3.
3. Ask the owner when a licence is unclear. Do not guess.
4. Use Python. Use standard tools first (`sqlite3`, `pandas`, `networkx`).
5. Write no em dashes or en dashes in code comments or documents.
6. Write documents in simple English: short sentences, one idea in each sentence.
7. Use metric units.
8. Record every decision in `docs/decisions.md` with the date and the reason.
9. After each milestone, write a short status note. State what works, what fails, and what comes next.
10. Do not add a Worker call to the default user path without owner approval. Follow section 8.3 and section 8.5.
