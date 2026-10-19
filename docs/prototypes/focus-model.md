# Prototype: focus model (2026-10-18 to 2026-10-19)

Input for the spec stage. The prototype itself lives on the branch `prototype/focus-model`, not on `main`.

## Question

Do the disclosure rules in PRD section 10.4 (Focus, Ring 1, Ring 2, Overflow Nodes, Your Path, Pinned Nodes, node limit) work when you walk real Genesis data?

## Verdict

Mostly yes, after ten rule changes. The rules are workable. The way a reader walks the graph needs its own design work: a fully 3D view is likely confusing, and a 2.5D view looks more intuitive.

## What it was

- One HTML file, `prototypes/focus-model/focus-model.prototype.html`, built by `build_data.py` from Theographic, the BSB, and OpenBible cross-references (Genesis only, cross-references only where both verses are in Genesis).
- No 3D. Lists and cards show what the scene would hold.
- The rules are a pure module, `FocusModel` (`reduce`, `scene`, `relation`), with no DOM code. Lift it into the front end at M3.
- To run it: check out the branch, run `python3 -I prototypes/focus-model/build_data.py <folder with theo/, bsb/, xref/>`, and open the HTML file.

## Rules changed by the prototype

| Decision | Change | What showed the problem |
|---|---|---|
| 24 | A click selects; a double click (or "Make Focus") moves the Focus. Prev and Next walk Your Path. | Reading about a past node meant moving the Focus back, which rebuilt the scene. |
| 25 | A Pinned Node brings its own top 3 neighbours of each type. Shared nodes are highlighted. | A pin with no neighbours showed nothing about the pinned node. |
| 26 | Edges from the Focus carry a relationship label, read from the Focus. | Edges had only a colour, so "partner" was invisible. |
| 27, 28 | Partners become husband, wife, or concubine from a curated table with an evidence verse. | Theographic does not separate wives from concubines. |
| 29 | Readers can send Correction Requests. | Data errors such as Anah and Beeri. |
| 30 | The "Genealogy of Jesus" group stays in Ring 1. | Owner decision. |
| 31, 32 | "Trail" becomes "Your Path". It covers the whole session; the scene draws the last 5. | The owner found "Trail" unclear. The limit of 5 had no evidence. |
| 33 | The node limit trims round robin and shows a note. | Trimming followed type order by accident. |

## Data findings

1. **Cosine weight works for hubs.** God is in 8,587 verses but is not in Abraham's Ring 1. With God as Focus the scene holds about 100 nodes.
2. **The node limit rarely matters at K = 6.** A busy scene wants about 100 nodes, under both the phone limit (150) and the desktop limit (500). The M3 frame rate test should set the limit, not the other way round.
3. **Family links fill Ring 1.** Abraham's six Ring 1 people are all family, so Lot never appears. Kept for now; review in M3.
4. **Shared nodes can be broad.** Jacob and Abraham share 14 nodes, because any co-mention counts. Review in M3.
5. **Theographic tags follow KJV wording.** Gen 22:2 in the BSB says "God said", but the KJV says "he said", so God has no link there. The reader panel can show a name the graph does not link.
6. **Some places link only by co-mention.** Hebron and Mamre reach Abraham as "together in 4 verses", because Theographic has no "lived at" link.
7. **The vote limit barely changes an entity view.** Entities have no cross-references, so the limit only thins Ring 2. On a verse view it is clear and useful.
8. **Native double click fails when the page redraws after the first click.** The prototype detects two clicks within 400 ms instead. Keep a visible "Make Focus" button too.
9. **Theographic data errors exist.** Anah's gender, and an Anah and Beeri partner link. Fixed in `pipeline/curated/`.

## Open for M3

1. **Navigation design.** How a reader walks the graph in 2.5D: selection, Make Focus, Your Path, pins, and how the camera moves. Prototype this as a UI prototype before building the front end.
2. Family links before co-mention in Ring 1 (finding 3).
3. How broad shared nodes are (finding 4).
4. Where the vote slider lives, given finding 7.
5. Node limit values for desktop and phone, from the frame rate test.
