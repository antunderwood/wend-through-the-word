# 05: Explicit relationship edges

**What to build:** entity files show family and event links with their direction kept, so the front end can read each link from either end ("Isaac is Abraham's son, Abraham is Isaac's father").

Edges: PARENT_OF with a role (father or mother), SIBLING_OF, HALF_SIBLING_OF, PARTICIPATED_IN, OCCURRED_AT, BORN_AT, DIED_AT, MEMBER_OF, and PARTNER_OF as Theographic gives it. Theographic has `halfSiblingsSameFather` and `halfSiblingsSameMother` (checked 2026-10-19), so HALF_SIBLING_OF comes from those fields only. It is never derived from shared parents (decision 36). Edges with a missing or unclear source are not loaded.

Each Neighbour carries its ID, type, edge type, direction, and weight. When one pair has several edges, they form one Neighbour with a combined edge type, as in the focus model prototype.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] In the fixtures, Abraham's entity file shows Isaac as a child and Isaac's shows Abraham as a parent with the father role
- [ ] A half sibling pair from Theographic's half sibling fields ships as HALF_SIBLING_OF, not SIBLING_OF
- [ ] No HALF_SIBLING_OF edge exists that Theographic does not give
- [ ] Every edge keeps its direction in the export
- [ ] Edges with no source are absent from the export and listed in the dropped edges report
- [ ] Every Theographic partner pair ships as PARTNER_OF for now, and the uncurated partner report lists it
- [ ] Every edge carries a `source` and a `licence`
