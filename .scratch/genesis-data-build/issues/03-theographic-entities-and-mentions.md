# 03: Theographic Entities and Mentions

**What to build:** each Person, Place, Event, and People Group named in the book range gets its own entity file, and each chapter file shows the Entities that each Verse mentions. Theographic decides identity: the build never merges two Entities. IDs are prefixed by type (for example `person:abel_1`).

Entity facts: Person gender; the Dictionary Entry from `dictText` (never `dictionaryText`), labelled as Easton's; Event Years in astronomical numbering (4004 BC is -4003). People carry no years.

Each entity file lists its Verse Neighbours, ranked by the number of other Entities in that Verse, ties broken by ID.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Every Entity in the book range has one entity file, under its type, with a prefixed ID
- [ ] Each chapter file shows, for every Verse, the MENTIONS links to the Entities it names
- [ ] Each Person has a gender; no Person has a year
- [ ] An Event dated 4004 BC in Theographic is exported as -4003
- [ ] No Dictionary Entry is taken from `dictionaryText`
- [ ] Verse Neighbours of an Entity are ordered by the number of other Entities in the Verse, then by ID
- [ ] Every Theographic verse link in the book range has a Verse Key or appears in the verse mismatch report, with its count and cause. A fixture has a mention with no BSB key
- [ ] Every Entity and MENTIONS link carries a `source` and a `licence`
