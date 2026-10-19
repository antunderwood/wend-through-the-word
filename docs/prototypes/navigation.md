# Prototype: navigation (2026-10-19)

Input for the M3 spec. The prototype itself lives on the branch `prototype/navigation`, not on `main`. While the ABC test runs it is public at https://wend-nav-prototype.email2ants.workers.dev (decision 113).

## Question

How should a reader walk the Genesis graph in 2.5D: selection, Make Focus, Your Path, pins, search, and how the camera moves? Does free orbit stay (decision 34)?

## Verdict

All three camera views carry the whole student journey ("studying Abraham"), and testers want to choose between them, so the view is selectable in the final app (decision 114). Testers leaned towards the tilted plane (A) as the default. The prototype also settled how the scene should be drawn and how it fits a phone; those rules are listed below for the M3 spec.

## What it was

- `prototypes/navigation/index.html` (view code, three.js 0.160 from a CDN) and `prototypes/navigation/model.js` (the pure `FocusModel` from `prototype/focus-model`, plus data loading). It reads the real Genesis export in `out/data`.
- Three views, switched with the pill or the Left and Right keys (`?variant=A|B|C`). They share the data, the rules, the layout skeleton, and the panel; only the camera, the node positions, and the decoration differ.
  - A, tilted plane: one ground plane, camera fixed at about 50 degrees. Drag pans, scroll or pinch zooms, no rotation.
  - B, stacked discs: Focus on top, Ring 1 on the disc below, Ring 2 on the lowest disc. Drag spins around the vertical axis.
  - C, free orbit: a 3D layout. Drag orbits freely.
- A guided tour walks a tester through "studying Abraham" in ten tasks (move the camera, search Abraham, select Sarah, select Abraham, open his Themes, select Faith, make Isaac the Focus, pin Abraham, Prev or Next, clear Your Path and undo). It records seconds per step and whether "Do it for me" was used, per view, and copies them as plain text.
- `prototypes/navigation/deploy.sh` stages the page, the export, the curated tables, and a credits page, and deploys them as Workers static assets.
- To run it locally: check out the branch, run `uv run python -m http.server 8000` from the repository root, and open `/prototypes/navigation/?variant=A`.

## Decisions made during the prototype

| Decision | Change |
|---|---|
| 111 | A Theme neighbour is weighted by shared Verses times the rarity of its heading, so Faith ranks above Veneration for Abraham. |
| 112 | A reader can write a note on each step of Your Path and download the journey (built in M4). |
| 113 | The prototype and its data snapshot are public for the ABC test. |
| 114 | The view is selectable in the final app: tilted plane, stacked discs, or free orbit. |

## Behaviour to carry into M3

1. **Search** covers names, aliases, and verse references ("Gen 22:2", "Genesis 22"), with a type filter. A click on a result, or Enter for the first one, makes it the Focus and closes the list.
2. **Your Path bar.** The Focus first, then Your Path newest first; a click selects. "Clear" empties Your Path (the Focus and pins stay) and "Undo clear" brings it back.
3. **Neighbour lists.** "N more" is a toggle that opens the full list for one type. A selected node lists the verses it shares with the Focus and each pin, with their text.
4. **Edges stop at the node border:** the disc, or the outer ring of a Selected, Pinned, or Shared Node. Node sprites face the camera, so the border point is measured across the view direction and edges update whenever the camera moves.
5. **Nodes draw above every line.** Node sprites ignore depth and draw after all lines; a ringed node has a background coloured mask inside its ring. Without this, A's grid spokes, B's axis, and edges behind a node in C crossed the circles.
6. **Phone layout (640 px wide or less).** The panel is a bottom sheet (46% of the height) with its toggle on the sheet's top edge. The scene is centred in the space above the sheet (a camera view offset). Search opens from a button. The Vote Limit slider lives in the panel.
7. **Phone decluttering.** Relationship words show only on the edge between the Focus and the Selected Node. The Focus label drops its dictionary subtitle. A name that would overlap a more important one is hidden until a tap or a zoom makes room; the order is the Selected Node, the Focus, Pinned Nodes, then Ring 1 by rank within each type.

## Data findings

1. **Relationship words cause most of the crowding on a phone.** Abraham as Focus at 390 x 844 px with the sheet open: 37 names and 31 relationship words. Overlapping label pairs were 107 (A), 240 (B), and 137 (C); 69 to 78% of them involved a relationship word. After rules 6 and 7 every view has 0 overlaps, showing 23 (A), 16 (B), and 21 (C) names at the starting zoom.
2. **B is the most crowded view on a phone.** Its tilted discs press Ring 1 into a thin band, so it shows the fewest names.
3. **Ring 1 size drives the label count.** For Abraham: K = 6 gives 37 labelled nodes, 31 relationship words, and 86 Ring 2 nodes; K = 4 gives 27, 21, and 63; K = 3 gives 22, 16, and 48. K stays 6; K = 4 on phones is held in reserve.
4. **A failed fetch stays failed.** Under many parallel requests the local test server reset connections, and `createData` caches the failure until reload. The live site did not show this, but the M3 loader should retry and should not cache an error.
5. **Tester results.** Testers preferred to be able to choose any of the three views, and leaned towards A as the default. Their per-step timings were collected by "Copy results" and are not summarised here.

## Open for the M3 spec

1. **The default view.** Testers leaned towards A; the owner confirms it.
2. **Phones.** Whether all three views are offered on a phone, given finding 2, and how the choice is made and remembered.
3. **The guided tour.** Whether a first-run guide is part of the product or stays in the prototype.
4. **Double tap in the panel lists on a phone.** The Selected Node section keeps a fixed height on a desktop, so a list does not move between the two clicks of a double click. On a phone it sizes to its content to save space, so a list can shift between taps. Make Focus works either way.
5. **Node limit values** for desktop and phone, from a frame rate test on real devices. The prototype shows the frame rate but the test was not run (headless runs use software rendering).
6. **Small rendering gap in C.** A faint, distant Ring 2 disc can show inside the gap of a ring, because masks draw below every disc.
7. **How broad Shared Nodes are** (still open from `docs/prototypes/focus-model.md`): with Abraham pinned and Isaac as the Focus, 27 nodes are shared. Family links before co-mention is settled by decision 94 (rank by weight alone).
8. **Order of a Verse's Ring 1.** The Entities and Themes a Verse names carry no weight in the export, so the prototype orders them by ID. The M3 spec needs a rule, for example their weight among the other Ring 1 nodes.
9. **Two Places share a label** ("Canaan"). Labels need a way to tell same-name nodes apart, for example the `displayTitle` suffix or a type and region hint.
10. **Search moves the Focus; other clicks select.** A click on a search result makes it the Focus at once, while a click in the scene or the panel only selects (decision 24). The difference is deliberate but needs teaching, for example in the hint or a first-run guide.
