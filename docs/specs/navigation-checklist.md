# Navigation: by-eye checklist

Checks for the node and edge look (issue #28, spec `docs/specs/navigation.md`, PRD 10.4) that a browser test cannot state as a rule. Run them on the fixture export with Abraham as the Focus, in each view, at the default size and after the moves listed. Tick a box only after looking at the page or a screenshot of it. Re-run the list when a ticket changes the graph module, a view, or the label styles.

The browser tests already cover: a click on a disc under another node's label, the Relationship words and "together in N verses" on the Selected and hovered nodes' edges, no two names overlapping with Isaac the Focus and Abraham pinned (`web/e2e/declutter.spec.ts`), the corner note for trimmed nodes, the Ring 2 hover path, labels gone at the farthest zoom in each view, camera flight, and reduced motion (`web/e2e/look.spec.ts`, `web/e2e/select.spec.ts`), and the student journey with scene clicks in each view (`web/e2e/journey.spec.ts`).

| Check | A, tilted plane | B, stacked discs | C, free orbit |
|---|---|---|---|
| No line crosses a disc or a ring; a line runs under a name, never over it | [x] | [x] | [x] |
| Edges meet the border (disc, or the white ring of the Selected Node) at the start | [x] | [x] | [x] |
| Edges meet the border after zoom in and zoom out | [x] | [x] | [x] |
| Edges meet the border after the view's drag: pan (A), spin (B), orbit (C) | [x] | [x] | [x] |
| Co-mention edges are dashed; their words are in italics | [x] | [x] | [x] |
| Labels fade with distance: all names near, only the Focus name at the farthest zoom | [x] | [x] | [x] |
| Hover on a Ring 2 node: it lights up, the tooltip reads "node → parent → Focus", and it goes faint again when the pointer leaves | [x] | [x] | [x] |
| The Focus has its accent colour, a soft glow, its name, and the first line of its Dictionary Entry | [x] | [x] | [x] |
| Depth fog dims nodes behind the Focus | n/a | n/a | [x] |
| Isaac the Focus, Abraham pinned: the Pinned ring (orange) and Shared rings (cyan) are masked inside, and edges meet them | [x] | [x] | [x] |

Checked 2026-10-20 on Chromium (Playwright, software WebGL), 1400 by 900. Re-ticked for every view on the finished M3 page (#31), after free orbit's start camera was raised (Isaac had sat behind the Focus) and its pins moved on screen, and A and B were let zoom out until only the Focus keeps its name.

## M4 panels

Checks for the panels of spec `docs/specs/reading-and-sharing.md` (issue #42). Run them on the real export with Anah of Gen 36:2 as the Focus (`?focus=person:anah_247`), the reader panel opened with "Read", a note written, the filter panel open, and then the correction dialog open from "Suggest a correction to Gender".

The browser tests already cover: the M4 journey in each view (`web/e2e/journey.spec.ts`), the search box, Your Path bar, reader panel, scene, and detail panel not overlapping at 1280 by 800 (`web/e2e/reader.spec.ts`), and the footer and credits page without WebGL (`web/e2e/credits.spec.ts`).

| Check | A, tilted plane | B, stacked discs | C, free orbit |
|---|---|---|---|
| Reader panel: a left drawer under the search box, serif text in large type with wide spacing, chapter title between the chapter buttons, "Berean Standard Bible" at the foot | [x] | [x] | [x] |
| Reader panel: Verses in the scene have a brighter number underlined with dots; the scene's nodes sit between the reader and detail panels | [x] | [x] | [x] |
| Filter panel: opens above the Filters button over the scene; type toggles in the type colours, the Vote Limit slider with its explanation, the book choice, and the animation switch all readable | [x] | [x] | [x] |
| Footer: one quiet line at the bottom left, "Data: CC BY-SA 4.0, credits" and the data version, clear of the reader panel and the view picker | [x] | [x] | [x] |
| Correction dialog: centred over the scene; the Evidence Verse and CC BY-SA 4.0 warning, the note on another way, "Open the form on GitHub", and Cancel | [x] | [x] | [x] |
| Note box: below the buttons with "Note on" and the name, the "this browser only" line, Download notes and Delete all notes; the noted step has its mark in the Your Path bar | [x] | [x] | [x] |

Checked 2026-10-20 on Chromium (Playwright, software WebGL), 1440 by 900, on the real Genesis export (data version 2026-10-19).

## Known gaps

- A drag that starts on a name does not pan or orbit; the wheel over a name still zooms.
- Masks draw below every disc, so in C a faint far disc can show inside a near ring (spec note 3). Not seen in this run.
- With the Focus selected, the detail panel keeps a blank two-line gap under the type line: the space the Relationship line holds (#37) so the shared list does not move between two clicks.
- The open filter panel covers the lower middle of the scene; it closes with Escape or a click outside.
