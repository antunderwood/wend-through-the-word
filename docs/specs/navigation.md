# Spec: Navigation front end (M3)

Status: ready-for-agent
Date: 2026-10-19
Sources: `PRD.md` (Draft 5), `GLOSSARY.md`, `docs/decisions.md` (decisions 24 to 34, 94, 111 to 122), `docs/prototypes/focus-model.md`, `docs/prototypes/navigation.md`

Terms follow `GLOSSARY.md`. Published as issue #18. The issue is the working copy for agents. This file is the reference copy. The navigation prototype is on the branch `prototype/navigation` (unmerged); read its `model.js` and `index.html` before building, and lift what it proved rather than starting again.

## Problem Statement

The Genesis data build (M0 to M2) ships a static export: chapter files, entity files, Ring 2 sidecars, a search index, and credits. Nothing a reader can use reads it yet.

Two prototypes answered the design questions. The focus model prototype settled the disclosure rules (Focus, Ring 1, Ring 2, Overflow Nodes, Your Path, Pinned Nodes, the node limit). The navigation prototype showed that a reader can walk the whole student journey ("studying Abraham") in each of three camera views, and testers wanted to choose the view. Both prototypes are throwaway code: one HTML file each, no types, no tests, three.js from a CDN, and a fetch cache that keeps a failure until reload.

A reader today cannot open the app, find Abraham, see who and what surrounds him, read the verses he shares with Faith, move to Isaac, keep Abraham pinned to compare, and step back along Your Path. The owner cannot set the node limit, because the frame rate test has never run on real hardware.

## Solution

A desktop web page, built in TypeScript with Svelte 5 and Vite, that reads the static export and lets a reader walk the Genesis graph:

1. **Three selectable views** of one scene: A, tilted plane (the default); B, stacked discs; C, free orbit. The views share the data, the Focus Model, and the panels; only the node positions, the camera, and the decoration differ. The reader's choice is remembered in the browser.
2. **The scene** draws the Focus, Ring 1 with Overflow Nodes, faint Ring 2, the last five nodes of Your Path, and Pinned Nodes with their own Neighbours, under the node limit. Edges from the Focus carry the Relationship. Shared Nodes are highlighted.
3. **Search** by name, alias, or verse reference, with a type filter. Choosing a result makes it the Focus.
4. **The Your Path bar** shows the Focus, then Your Path newest first. It can be cleared, and the clear undone.
5. **The panel** shows the Selected Node: its type, its Relationship to the Focus, the verses it shares with the Focus and each Pinned Node (with BSB text), its Neighbours by type with "N more" toggles, and the buttons Make Focus, Pin or Unpin, Prev, and Next.
6. **A dismissible hint** teaches that a click selects and a double click (or Make Focus, or search) moves the Focus.
7. **A node limit test page** measures the frame rate of each view at rising node counts, so the owner can set the desktop limit.

Two small build changes support it: a weight on each Mention and Filed Under, so a Verse's Ring 1 has an order, and a hint on Entities whose name another Entity of the same type shares.

## User Stories

### Reader: starting

1. As a reader, I want the page to open on a sensible first Focus (Abraham), so that I see a graph before I know what to search for.
2. As a reader, I want the first view to load in under 3 seconds on a home network, so that I do not give up waiting.
3. As a reader, I want to see a short hint about click and double click, so that I learn how to move without a manual.
4. As a reader, I want to dismiss the hint and not see it again in this browser, so that it does not get in my way once learned.
5. As a reader whose browser has no WebGL, I want the panel and its Neighbour lists to work without the scene, so that I can still explore.
6. As a reader, I want a clear message when a data file fails to load, and a retry, so that a network blip does not leave a broken page until I reload.

### Reader: choosing a view

7. As a reader, I want to choose between the tilted plane, stacked discs, and free orbit, so that I can explore in the way that suits me.
8. As a reader, I want the tilted plane as the default, so that I start with the view testers found easiest.
9. As a reader, I want my chosen view remembered in this browser, so that I do not pick it again on every visit.
10. As a reader, I want switching view to keep my Focus, Selected Node, Your Path, and pins, so that changing view never loses my place.
11. As a reader, I want to switch view with the keyboard (Left and Right on the view picker), so that I do not need the mouse.
12. As a reader in the tilted plane, I want drag to pan and scroll to zoom with no rotation, so that I cannot lose my bearings.
13. As a reader in stacked discs, I want the Focus on top, Ring 1 on the disc below, and Ring 2 on the lowest disc, and drag to spin about the vertical axis, so that the rings read as layers.
14. As a reader in free orbit, I want drag to orbit freely, so that I can look at the graph from any side.

### Reader: reading the scene

15. As a reader, I want the Focus drawn at the centre, larger, in the accent colour, with its name and the first line of its Dictionary Entry, so that I know where I am.
16. As a reader, I want Ring 1 placed in sectors by type around the Focus, so that I learn where to look for People, Places, Events, People Groups, Themes, and Verses.
17. As a reader, I want at most K (6) Neighbours of each type in Ring 1, ranked by weight, so that the scene stays readable.
18. As a reader, I want one Overflow Node for each type with more Neighbours, labelled like "+30 people", so that I know more exist.
19. As a reader, I want Ring 2 faint, small, and unlabelled, so that it shows the shape of the graph without noise.
20. As a reader, I want a Ring 2 node to show its name and its path to the Focus when I hover over it, so that I can see why it is there.
21. As a reader, I want each node type to have one icon and one muted colour, so that I can tell types apart at a glance.
22. As a reader, I want flat nodes that face the camera, not spheres, so that the scene looks modern and labels stay readable.
23. As a reader, I want a Verse node to show a short BSB quote, not only its reference, so that I know what the verse says.
24. As a reader, I want each edge from the Focus labelled with the Relationship read from the Focus (son, wife, birthplace, took part), so that I know how each Neighbour connects.
25. As a reader, I want a link that is only a Co-mention drawn dashed and labelled "together in N verses", so that I can tell derived links from stated ones.
26. As a reader, I want edges to stop at the node's border and nodes to draw above every line, so that no line crosses a circle or its name.
27. As a reader, I want a quiet note in a corner when nodes are hidden by the node limit ("39 faint nodes hidden to keep the view fast"), so that I know the scene is trimmed.
28. As a reader, I want two Entities with the same name and type told apart in labels and search (for example the three Anahs), so that I do not confuse them.
29. As a reader, I want far nodes to lose their labels and near nodes to keep them, so that the scene is not a wall of text.

### Reader: selecting and moving

30. As a reader, I want a click on a node to select it and show it in the panel without changing the scene, so that I can read about a node without losing my place.
31. As a reader, I want a double click on a node, or Make Focus in the panel, to make it the Focus, so that I can move through the graph.
32. As a reader, I want the camera to fly to the new Focus in about 600 to 800 ms with easing, with new nodes growing out of the clicked node and the old Ring 1 fading, so that I can follow the move.
33. As a reader who prefers reduced motion, I want no camera flight or growth animation, so that the page respects my setting.
34. As a reader, I want a click on an Overflow Node to open its full list in the panel, never adding nodes to the scene, so that the scene stays within the limit.
35. As a reader, I want the arrow keys to move the selection between Ring 1 nodes, Enter to make the Selected Node the Focus, and Backspace to go back to the previous Focus, so that I can explore with the keyboard.

### Reader: search

36. As a reader, I want to search by name or alias ("Abram" finds Abraham, "Luz" finds Bethel), so that I can find an Entity by any name the text uses.
37. As a reader, I want to search by verse reference ("Gen 22:2", "Genesis 22"), so that I can start from a verse or a chapter.
38. As a reader, I want to filter search results by type (Person, Place, Event, People Group, Theme, Verse, or none), so that a common name does not bury what I want.
39. As a reader, I want a click on a result, or Enter for the first one, to make it the Focus and close the list, so that search takes me straight there.

### Reader: Your Path

40. As a reader, I want every node that has been the Focus this session kept on Your Path, each once at its latest visit, so that I can retrace my study.
41. As a reader, I want the last five nodes of Your Path drawn as small dim nodes joined to the Focus, so that I see where I came from.
42. As a reader, I want a Your Path bar showing the Focus first and then Your Path newest first, where a click selects, so that I can read about any earlier node without moving.
43. As a reader, I want Prev and Next in the panel to step the selection along Your Path without moving the Focus, so that I can review my journey.
44. As a reader, I want to clear Your Path while keeping the Focus and pins, so that I can start a new line of study.
45. As a reader, I want to undo a clear, with the cleared nodes restored before any I visited since, so that a mistaken clear costs nothing.

### Reader: pins and comparing

46. As a reader, I want to pin up to three nodes that stay in the scene when the Focus changes, so that I can compare them with the new Focus.
47. As a reader, I want each Pinned Node to bring its own top 3 Neighbours of each type (no Ring 2), so that I see what surrounds the pin.
48. As a reader, I want a clear refusal when I try to pin a fourth node or an Overflow Node, so that I know why nothing happened.
49. As a reader, I want Shared Nodes (in the top K of their type for both the Focus and a pin) highlighted, so that I can see what two nodes have in common without most of the scene lighting up.
50. As a reader, I want to unpin a node from the panel, so that I can make room for another.

### Reader: the panel

51. As a reader, I want the panel to show the Selected Node's name, type, and Relationship to the Focus, so that I know what I selected.
52. As a reader, I want the panel to list the verses the Selected Node shares with the Focus and with each Pinned Node, with their BSB text, so that I can read the evidence for a link ("Together in 18 verses").
53. As a reader, I want the Selected Node's Neighbours listed by type in weight order, with an "N more" toggle that opens and closes the full list for one type, so that I can see beyond Ring 1.
54. As a reader, I want a click on a list item to select it and a double click to make it the Focus, so that lists behave like the scene.
55. As a reader, I want to collapse the panel with a chevron that points the way it will move, so that I can give the scene the whole width.
56. As a reader, I want the panel never to cover the Your Path bar, so that both stay usable.

### Owner

57. As the owner, I want a node limit test page that renders each view at rising node counts and reports the frame rate, so that I can set the desktop node limit from evidence (PRD 11).
58. As the owner, I want the test page also to load the Genesis hub nodes (God, Jacob, Egypt, Canaan) as the Focus with the real rules, so that I see real demand next to the synthetic counts.
59. As the owner, I want the glow on the Focus and depth fog in the free orbit view switched on and off on the test page, so that I can see what they cost on a mid-range laptop.
60. As the owner, I want a Verse Focus to order its People, Places, Events, People Groups, and Themes by a weight from the build, so that the rarest and most specific (Moriah in Gen 22:2) comes before the most common.
61. As the owner, I want the build to give a hint to every Entity whose name another Entity of the same type shares, so that labels can tell them apart from the data alone.
62. As the owner, I want the page to read the data version from `index.json` and load only versioned files after it, so that a new build never mixes with a cached old one.

### Developer

63. As a developer, I want the Focus Model as a pure module with no DOM and no three.js, so that every disclosure rule is tested in milliseconds.
64. As a developer, I want the graph module to import no Svelte, so that the scene can be reused and tested apart from the panels (PRD 10.3 rule 1).
65. As a developer, I want each view to be a thin module (positions, camera, controls, decoration) over one scene, so that a feature is built once and placed by each view (decision 114).
66. As a developer, I want the data loader to take an injected JSON fetcher, so that it runs in tests on files and in the browser on fetch.
67. As a developer, I want the front end tests to read an export built from the existing fixture sources, so that they check the same data contract the build tests check.
68. As a developer, I want a browser test that walks the student journey in each view, so that a broken click handler or a view that fails to load is caught in CI.

## Implementation Decisions

### Scope and stack

- **M3 builds the desktop journey page** (decision 117): the three views, the scene, search, the Your Path bar, the panel parts the journey uses, the hint, and the node limit test page. M4 keeps the reader panel, the filter panel (type toggles, Vote Limit slider, book filter), shareable URLs, "Suggest a correction" links, the full detail panel facts, the credits page, and journey notes. M7 keeps the phone layout. Write the layout so the phone needs no rewrite: the prototype's phone rules (bottom sheet, decluttering) must fit without changing the module boundaries.
- **TypeScript, Svelte 5 with Vite, no SvelteKit.** Svelte runs the panels, search, the Your Path bar, the view picker, and the hint in M3 (amends PRD 10.3 rule 4). Check every Svelte example against the Svelte 5 runes documentation.
- **three.js directly, not 3d-force-graph** (decision 116). Every layout is deterministic: Ring 1 in sectors by type, Ring 2 on an outer band near its parent, no force simulation (amends PRD 10.3 and PRD 10.4 layout rule 3). three.js is a pinned npm dependency, bundled by Vite, not loaded from a CDN.
- The front end is its own package beside the Python pipeline, with its own lockfile. The Python build stays the only producer of data.

### Modules

1. **Data loader.** Reads `index.json` (short cache), then only files under its `data_version`. Loads entity files, chapter files, and chapter Ring 2 sidecars on demand, and the search index once. Offers: load a record for an ID (Entity ID or Verse Key, normalised to one record shape with `links` sorted by weight and `ring2`), the label and hint for any ID, gender for Relationship words, the verses two nodes share with their text, and search. A failed fetch is retried once and never cached; a second failure is reported to the page (navigation finding 4). Takes an injected `getJSON(url)`.
2. **Focus Model.** Pure. `initialState(focus)`, `reduce(state, action)`, `scene(state, record)`, `relation(link, gender)`. It owns every disclosure rule: Ring 1 top K of each type by weight then ID (decision 94), Overflow, Ring 2 (up to 3 of each Ring 1 node's stored top 10 that pass the filters and are not already on screen), pins and their top 3 of each type, Shared Nodes, Your Path, and the node limit with round robin trimming (decision 33). Lift it from the prototype and add types.
3. **Graph module.** No Svelte import. Draws a Scene with three.js. Interface: `render(scene, selected)`, `setView(view)`, `onNodeClick`, `onNodeDoubleClick`, `onHover`, `dispose`, and a frame rate callback for the test page (replaces the PRD's `setFocus`, `setFilters`, `onNodeClick`: the Focus Model now owns focus and filters). Double click is detected as two clicks within 400 ms on the same node, because the page may redraw between the clicks (focus model finding 8).
4. **View modules A, B, C.** Each gives node positions for a Scene, a camera, controls, and decoration (A's grid, B's discs and axis). Nothing else differs between views. A: one ground plane, camera fixed at about 50 degrees, drag pans, scroll zooms, no rotation. B: Focus on top, Ring 1 on the disc below, Ring 2 on the lowest disc, drag spins about the vertical axis. C: a 3D layout, drag orbits.
5. **App shell (Svelte).** Holds the Focus Model state, dispatches actions, and renders search, the Your Path bar, the panel, the view picker, the hint, the notice line, and the corner note for trimmed nodes.
6. **Node limit test page.** A second Vite entry. Synthetic scenes of 100, 250, 500, 750, and 1,000 nodes of mixed types in each view, plus the hub Focus scenes (God, Jacob, Egypt, Canaan) under the real rules; glow and fog toggles; frame rate per view. The owner records the result as a decision and sets the desktop node limit (PRD 11). The phone limit waits for M7.

### Focus Model shape (from the prototype)

Trimmed from `model.js` on `prototype/navigation`; the logic is proven there.

```ts
type View = "A" | "B" | "C";
type State = {
  focus: Id; selected: Id;
  path: Id[];            // every earlier Focus, each once, latest visit last
  pins: Id[];            // at most 3
  cleared: Id[] | null;  // what the last clearPath removed, for undoClear
  filters: { k: number; minVotes: number; nodeLimit: number };
  notice: string;
};
type Action =
  | { type: "focus" | "select" | "pin" | "unpin"; id: Id }
  | { type: "step"; dir: -1 | 1 }          // Prev and Next along [...path, focus]
  | { type: "setFilter"; key: keyof State["filters"]; value: number }
  | { type: "clearPath" }                   // Focus and pins stay; a Selected Node only on Your Path gives way to the Focus
  | { type: "undoClear" };                  // cleared nodes go back before any visited since, each once
type SceneNode = {
  id: Id; type: NodeType; role: Role; roles: Role[]; shared: boolean;
  ring1?: { ti: number; pos: number; m: number };  // sector index, place in sector, sector size
  pinIndex?: number; pathIndex?: number; via?: Id; rank?: number; count?: number;
};
type Role = "focus" | "pinned" | "ring1" | "pinring" | "path" | "ring2" | "overflow";
// Role priority when a node has several: focus, pinned, ring1, pinring, path, ring2.
type Scene = {
  nodes: SceneNode[];
  edges: { a: Id; b: Id; kind: "focus" | "overflow" | "ring2" | "pin" | "path"; label?: string; dashed?: boolean }[];
  count: number; demand: number; hidden: number;
  trimmed: { ring2: number; path: number; pinring: number };
  hiddenVotes: number;
};
```

### Rules the prototype settled (decision 115)

- **Shared Node** (decision 119, amends decision 25, PRD 10.4 rule 7, and the glossary): a node in Ring 1 or around a pin that is in the top K of its type, after filters, for both the Focus and that pin. With Isaac as the Focus and Abraham pinned this highlights 8 of 42 nodes (Sarah, Abimelech, Gerar, Covenant, and others), where "any link" highlighted 28.
- **Search** covers names, aliases, and verse references with a type filter; a result's click or Enter makes it the Focus and closes the list. Everywhere else, a click selects (decision 24). The hint teaches the difference.
- **Your Path bar**: the Focus first, then Your Path newest first; a click selects; "Clear" and "Undo clear".
- **Neighbour lists**: "N more" is a toggle per type. The Selected Node lists the verses it shares with the Focus and with each pin, with BSB text.
- **Edges stop at the node border** (the disc, or the outer ring of a Selected, Pinned, or Shared Node). Nodes face the camera, so the border point is measured across the view direction and edges update whenever the camera moves.
- **Nodes draw above every line.** Node sprites ignore depth and draw after all lines; a ringed node has a background coloured mask inside its ring.
- **Default view and memory** (decision 118): the tilted plane (A) is the default. The reader's choice is kept in browser storage, wrapped so the page works when storage is blocked. From M4 the shared URL also carries it.
- **The hint** (decision 120): one dismissible line near the scene, remembered in the browser. A first-run tour is a later ticket (M5), without the prototype's timings.

### Build changes

Both go through the existing build seam and keep every file under the size limit.

- **Weight on Mentions and Filed Under** (decision 121). Each `mentions` and `filed_under` item in a chapter file gains `weight` = ln(31,102 / the Entity's whole-Bible Verse count), rounded to 4 places, the same rarity term as decision 111. A Verse Focus ranks its Ring 1 Entities of each type by it, highest first, then ID. Gen 22:2: Moriah before Isaac.
- **Same-name hint** (decision 122). In Genesis, 39 names belong to more than one Entity (Anah 3, Bela 3, Canaan as a Person and a Place). A `search-index.json` entry whose `name` another entry of the same type shares gains `hint`: the reference of its first whole-Bible Verse that no same-named Entity of that type shares ("Gen 36:24"), or else the number in its ID. Entities of different types are told apart by type icon and colour, not a hint. Labels and search results show the hint after the name.

## Testing Decisions

- **Two seams for the front end, plus the existing build seam.**
  1. **Focus Model and data loader** (Vitest, no DOM). Tests load records through the data loader, with `getJSON` reading files from an export built from the existing fixture sources, then drive `reduce` and read `scene`. Expected values come from the fixture export and are stated in each test, as `tests/test_comention.py` does for the build.
  2. **The student journey in the browser** (Playwright, Chromium). The built page served with the fixture export. The journey runs once per view: search "Abraham" (it becomes the Focus and the list closes); select a Ring 1 Person (panel shows it, scene unchanged); open Abraham's Themes with "N more" and close it; select a Theme and read the shared verses; make a Person the Focus (the Your Path bar shows it then Abraham); pin Abraham; Prev and Next; Clear and Undo clear; switch view (state kept); reload (view remembered). Scene clicks use node screen positions from a test-only hook on the graph module; panel and search clicks use the DOM.
  3. **Build changes** use the existing seam: run the build on the fixtures, assert on `out/data`.
- **What makes a good test here.** It states a rule a reader could check: "a fourth pin is refused", "clear then undo gives back Your Path with newer visits after the restored ones", "with the Vote Limit at 5 no Cross-reference below 5 votes is in Ring 1", "Shared Nodes are in both top K lists". It does not check how a module stores or computes something, or what three.js objects exist.
- **Cases the Focus Model tests must cover:** Ring 1 top K per type and Overflow counts; ties broken by ID; a Verse Focus (Cross-references by Votes, Entities by the new weight); Ring 2 skips nodes already on screen and Cross-references under the Vote Limit; pins (limit 3, Overflow refused, pin equals Focus); Shared Nodes; Your Path each once, latest visit; Prev and Next at both ends and off the path; clear and undo with visits in between; the node limit trimming Ring 2, then the oldest of Your Path, then pin rings, round robin, never the Focus, pins, Ring 1, or Overflow Nodes; Relationship words for each edge and gender, including wife and concubine.
- **Data loader cases:** a fetch that fails once then succeeds; a fetch that fails twice is reported and not cached; only versioned paths after `index.json`.
- **Checked by eye, with a written checklist per view:** edges at the border, nodes over lines, label fading with distance, the Focus glow, camera flight and reduced motion, hover on Ring 2. The checklist lives with the spec's tickets.
- **CI.** One more job: build the fixture export with the Python pipeline, then run Vitest and Playwright. The Python job stays as it is.
- **Prior art.** `tests/conftest.py` and `tests/test_comention.py` for the build seam; the prototype's `model.js` for the rules and its guided tour steps for the journey script.

## Out of Scope

- Phone layout and decluttering, touch controls, and the phone node limit (M7). The prototype's rules are recorded in decision 115 and `docs/prototypes/navigation.md`.
- Reader panel, filter panel, shareable URLs, "Suggest a correction" links, correction notes, the credits page, and journey notes (M4).
- The first-run guided tour (M5 ticket).
- The Cloudflare deploy of the product, and the repository going public (M5).
- The whole Bible (M6), and hub tests on Jesus and Jerusalem, which are not in Genesis.
- The light theme.
- Moving particles on Focus edges (PRD 10.4 edge rule 4). The Relationship words already show direction; revisit after the node limit test shows the frame budget.
- Any Worker, D1, or KV code.

## Further Notes

1. **Decisions 116 to 122** record the owner's answers for this spec: renderer, M3 scope, default view, Shared Nodes, the hint, the Mention weight, and the same-name hint.
2. **Correction to the navigation findings.** Open item 9 says two Places share the label "Canaan". The export has one Place and one Person named Canaan, both first in Gen 11:31. Other same-type clashes on a first Verse exist ("Valley of Shaveh" is two Places in Gen 14:17, likely a Theographic duplicate), which is why the hint falls back to the ID number.
3. **Small rendering gap in free orbit.** A faint, distant Ring 2 disc can show inside a ring's gap, because masks draw below every disc. Known; fix only if it shows in the eye checklist.
4. **Node limit values** stay at 500 (desktop) until the test page has run on a mid-range laptop. Real Genesis scenes want about 100 nodes at K = 6, so the synthetic counts matter more than the hubs.
5. **The prototype stays on its branch.** Lift code from it; do not merge it.
