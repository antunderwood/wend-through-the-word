# Navigation: by-eye checklist

Checks for the node and edge look (issue #28, spec `docs/specs/navigation.md`, PRD 10.4) that a browser test cannot state as a rule. Run them on the fixture export with Abraham as the Focus, in each view, at the default size and after the moves listed. Tick a box only after looking at the page or a screenshot of it. Re-run the list when a ticket changes the graph module, a view, or the label styles.

The browser tests already cover: a click on a disc under another node's label, the Relationship words and "together in N verses" on the Focus edges, the corner note for trimmed nodes, the Ring 2 hover path, labels gone at the farthest zoom, camera flight, and reduced motion (`web/e2e/look.spec.ts`, `web/e2e/select.spec.ts`).

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

Checked 2026-10-20 on Chromium (Playwright, software WebGL), 1400 by 900.

## Known gaps

- Long names still overlap in the back sector of A and B (People: "Haran (brother of Abraham)", "Nahor (brother of Abraham)"). B's rings were widened and its camera raised for #28, which cleared most of the crowding.
- The Focus edges carry many words at the default zoom ("named in this verse", "together in 1 verse"), as PRD 10.4 edge look 6 asks. They fade with distance like names.
- A drag that starts on a name does not pan or orbit; the wheel over a name still zooms.
- Masks draw below every disc, so in C a faint far disc can show inside a near ring (spec note 3). Not seen in this run.
