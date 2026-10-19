# 07: CO_MENTION and entity Ring 2

**What to build:** most People link to more than unranked Verses, and God is not the top Neighbour of everyone. The build derives a CO_MENTION edge for every pair of Entities that share a Verse. Its weight is the cosine score: shared Verses divided by the square root of (Verses of A times Verses of B). The Verse set of an Entity is the union of its Mention and Filed Under Verses. Each CO_MENTION carries its shared verse count, so the front end can say "together in N verses".

Each entity file then holds its full sorted Neighbour list, the Overflow count for each type at the default K, and the top 10 Neighbours of each of its top Neighbours (for Ring 2 with one fetch). Ranking: explicit relationship edges first, then weight descending, ties broken by ID.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Every pair of Entities that shares a Verse has a CO_MENTION edge with a cosine weight and a shared verse count
- [ ] A fixture hub Entity in many Verses is not the top Neighbour of a fixture Person it shares a few Verses with
- [ ] On the slow full-Genesis run, God is not in Abraham's Ring 1
- [ ] Explicit edges rank before CO_MENTION, whatever the weights
- [ ] A pair with an explicit edge and a CO_MENTION is one Neighbour with a combined edge type
- [ ] Each entity file has Overflow counts per type at the default K, and the top 10 Neighbours of each top Neighbour
- [ ] Every entity file stays below 500 KB
