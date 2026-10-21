# Spec: Reading, details, and sharing (M4)

Status: ready-for-agent
Date: 2026-10-20
Sources: `PRD.md` (Draft 5, sections 3, 10.1, 10.2, 10.5), `GLOSSARY.md`, `docs/decisions.md` (decisions 24 to 34, 75, 112, 114 to 132), `docs/specs/navigation.md`

Terms follow `GLOSSARY.md`. Published as issue #33. The issue is the working copy for agents. This file is the reference copy. M3 (spec #18, merged in #32) built the scene, search, the Your Path bar, and the parts of the panel the student journey needs; this spec builds on that code, not beside it.

## Problem Statement

A reader can now walk the Genesis graph, but cannot read the Bible text around what they find, cannot see most of what the data knows about a node, and cannot keep or share what they discovered.

- There is no reader panel. A Verse shows a short quote in the scene and a line in a list, but the chapter it sits in cannot be read, and a reader cannot move from reading to exploring.
- The detail panel shows a node's name, type, Relationship, shared Verses, and Neighbour lists. It does not show the Dictionary Entry, aliases, an Event Year, a Place's coordinates, every linked Verse, where a fact came from, or that the owner corrected it.
- Nothing can be filtered: every node type always shows, the Vote Limit is fixed at 1, Cross-references to books outside the build fill Ring 1 with Verses that cannot be opened, and animation cannot be turned off by hand.
- The page address never changes, so a reader cannot share or bookmark a Focus.
- A reader who finds a data error (Theographic has many) has no way to report it from the page, and a corrected item looks no different from any other.
- A student cannot write down what they learnt on the way (decision 112), so a session leaves nothing behind.
- The credits the licences require (PRD 5, rule 6) are in `credits.json` but nowhere on the page.

## Solution

1. **A reader panel** on the left, under the search box, shows the BSB text of a chapter. A click on a Verse selects it, a double click makes it the Focus. It follows the Selected Verse, opens by itself whenever a Verse becomes the Focus or the page opens on an address whose Focus is a Verse, and opens from a "Read" button (decisions 138, 140, 147).
2. **The full detail panel** adds the Dictionary Entry (named as Easton's), aliases, gender, Event Year ("approx., Jones chronology"), Place coordinates with their source, all linked Verses, the source and licence of each fact and link as a hover title (decision 139), curated notes with their Evidence Verses, and "Corrected after review" notes.
3. **A filter panel** has node type toggles, the Vote Limit slider with its explanation, a book filter that can hide Verses outside the build, and an animation switch.
4. **Shareable addresses**: the page address holds the Focus, the Selected Node, the pins, the filters, and the view. Opening it restores them. Back and Forward move between Foci.
5. **"Suggest a correction"** opens the GitHub issue form with the node IDs, the current value, the data version, and the page address filled in, from a button for the Selected Node and a small link beside each Relationship, fact, and linked Verse.
6. **Journey notes**: a note on each step of Your Path, kept in the browser, downloadable as a Markdown file.
7. **An "About and credits" page** lists every source, its licence, its link, and the modification notice, reached from a footer link; it is the one place the page shows sources and licences (decision 139).

No build change is expected: the export already carries corrections, Evidence Verses, notes, sources, licences, coordinates, Event Years, and credits. If one is needed, it goes through the existing build seam.

## User Stories

### Reader: reading the text

1. As a reader, I want a Verse's full BSB text in the detail panel under its reference, and the whole chapter in the reader panel beside the graph, which opens by itself when a Verse becomes the Focus or a link to a Verse opens (decisions 138, 147), so that I see each Verse in its context.
2. As a reader, I want a "Read" button that opens the reader panel at the chapter of the Focus (or of the Selected Node's first linked Verse), and closing the reader panel to last until the next Verse becomes the Focus (decision 140), so that I can start reading from any node and keep the space when I want it.
3. As a reader, I want an open reader panel to scroll to and highlight the Selected Verse, while a click on a Verse only selects it and never opens the reader panel, so that I do not lose my place.
4. As a reader, I want a click on a Verse in the reader panel to select it and a double click to make it the Focus, as in the scene and the lists, so that reading and exploring use one set of rules.
5. As a reader, I want the Verses in the reader panel that are in the scene marked quietly, so that I can see which ones the graph links.
6. As a reader, I want previous and next chapter buttons in the reader panel, within the build, so that I can read on.
7. As a reader, I want the reader panel to use the app's sans font, large type, and wide spacing (PRD 10.4 page design, decision 137), so that long reading is comfortable.
8. As a reader, I want to close the reader panel and have the scene use the space, so that I can explore with the whole screen.
9. As a reader, I want the reader panel to say which translation it is (Berean Standard Bible), so that I know what I am reading.

### Reader: the detail panel

10. As a reader, I want the Selected Node's Dictionary Entry shown in full, named "Easton's Bible Dictionary (1897)", so that I can read about it and know it is a 19th century source.
11. As a reader, I want a long Dictionary Entry folded after its first paragraph with a "Read more" toggle, so that the panel stays short.
12. As a reader, I want a Person's aliases and gender, a Place's other names and coordinates with their source, and an Event's year labelled "approx., Jones chronology", so that I have the facts the data holds.
13. As a reader, I want every Verse a node is linked to listed (Mentions and Filed Under), in Bible order, with an "N more" toggle, so that I can read all of them, not only those in Ring 1.
14. As a reader, I want each fact and link to keep where it came from (for example "Theographic, CC BY-SA 4.0") in its hover title, with every source and licence listed on the "About and credits" page (decision 139), so that I can judge it, the licences are honoured, and the panel stays uncluttered.
15. As a reader, I want a curated Relationship (wife, concubine, possibly the same person) to show its note and Evidence Verses, so that I can check the owner's reading.
16. As a reader, I want a corrected item to say "Corrected after review: gender (Gen 36:24)" with a link to the request when there is one, so that I know the data was changed and why (PRD 10.5 rule 6).
17. As a reader, I want a Verse outside the build to show its reference and that it is outside the build, as now, and the reader panel to say the same, so that I am never offered text that cannot load.

### Reader: filters and settings

18. As a reader, I want to turn each node type on or off, so that I can study only People, or only Themes.
19. As a reader, I want a turned-off type to leave Ring 1, Ring 2, the pin rings, its Overflow Node, and the Neighbour lists, so that the filter means the same everywhere.
20. As a reader, I want a Vote Limit slider with the explanation "Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength.", so that I understand what I am filtering.
21. As a reader with an Entity as the Focus, I want the slider to say it only changes Ring 2, so that I am not puzzled when Ring 1 does not move.
22. As a reader, I want a book filter that hides Verses outside chosen books, including a choice to hide Verses outside this build, so that Ring 1 is not filled with Cross-references I cannot open.
23. As a reader, I want a switch that turns animation off, and the page to respect my system's reduced motion setting, so that the camera never moves in a way I find hard to follow (PRD 10.2 rule 6).
24. As a reader, I want my filters kept in the page address, so that a shared link shows what I saw.

### Reader: sharing and history

25. As a reader, I want the page address to change when the Focus, Selected Node, pins, filters, or view change, so that I can copy it at any moment.
26. As a reader, I want a "Copy link" button, so that sharing does not need the address bar.
27. As a reader, I want to open a shared link and see the same Focus, Selected Node, pins, filters, and view, so that the sender and I look at the same thing.
28. As a reader, I want a link with a missing or unknown node to open on Abraham with a notice, so that a broken link still gives me a page.
29. As a reader, I want the browser's Back and Forward to move between the Foci I visited, so that the browser behaves as I expect.
30. As a reader, I want selecting a node or changing a filter not to fill my browser history, so that Back is still useful.

### Reader: correction requests

31. As a reader, I want a "Suggest a correction" button for the Selected Node, so that I can report a data error without leaving the page.
32. As a reader, I want a small "Suggest a correction" link beside the Relationship, and on each fact and list row when I hover it, focus it with the keyboard, or select its node (decision 139), so that the request is about one specific thing and rows stay one line.
33. As a reader, I want the request form already filled in with the node IDs, what the app shows now, the data version, and the page address, so that I only write the correction and my Evidence Verse.
34. As a reader, I want to be told before I leave that a request needs at least one Evidence Verse and is published under CC BY-SA 4.0, so that I am not surprised by the form.
35. As a reader without a GitHub account, I want a "Send it by email" link with the same filled-in fields, and to be told before I write that the owner copies each email into a GitHub issue without my name or email address, then deletes it (decision 145), so that I am not shut out.

### Student: journey notes

36. As a student, I want to write a note on any node of Your Path, including the Focus, so that I capture what I learnt at each step.
37. As a student, I want the note box in the detail panel when the Selected Node is the Focus or on Your Path, so that I write the note where I read about the node.
38. As a student, I want steps with a note marked in the Your Path bar, so that I can see where I wrote something.
39. As a student, I want my notes kept in this browser across reloads, with Your Path, so that closing the tab does not lose my work.
40. As a student, I want to be told plainly that notes stay in this browser only, so that I know to download them.
41. As a student, I want to download my journey as a Markdown file: one heading per step in the order I visited, the node's name and type, my note, and a link back to that node, so that I can keep, print, or paste it.
42. As a student, I want Clear and Undo clear to keep my notes, so that clearing Your Path never deletes writing.
43. As a student, I want a way to delete all my notes, with a confirmation, so that I can start a new study cleanly.

### Reader: credits

44. As a reader, I want a footer link "About and credits" beside the data licence (decision 139), so that I can find where the data comes from.
45. As a reader, I want a credits page listing every source with its credit, licence, and link, the modification notice, and a link to the curated tables, so that the licences are met (PRD 5 rule 6, CC BY-SA modification notice).

### Owner

46. As the owner, I want every correction link to go to the "Correction request" issue form with its stable field IDs, so that requests arrive in one shape.
47. As the owner, I want the mailto fallback to be one small change once I choose the address, so that it does not hold up M4.
48. As the owner, I want the page address format documented and stable, so that links shared now still work after later releases.
49. As the owner, I want the reader panel built so that on a phone (M7) it becomes a second tab of the bottom sheet, so that the phone needs no rewrite.

### Developer

50. As a developer, I want the page address read and written by one pure module, so that its rules are tested without a browser.
51. As a developer, I want the correction link built by one pure function from a node and a field, so that every entry point fills the form the same way.
52. As a developer, I want the notes download built by one pure function from Your Path and the notes, so that the file format is tested without a browser.
53. As a developer, I want type and book filters to live in the Focus Model's filters, so that the scene, the pin rings, the node limit, and the lists all obey them through one rule.

## Implementation Decisions

### Layout

- **Reader panel: a left drawer** under the search box (decision 127). The detail panel stays on the right, the scene sits between them, and both collapse. On a phone (M7) the reader panel becomes a second tab, "Reader", of the bottom sheet beside "Details" (decision 115); build it as a component that does not assume where it is mounted.
- The filter panel opens from a small "Filters" button by the view picker, as a popover over the scene, not a third side panel.
- The footer is one quiet line at the bottom left: "Data: CC BY-SA 4.0, credits" and the data version.

### Modules

1. **URL state (new, pure).** `read(search: string, known: (id) => boolean) => Partial<State> & { view?, notice? }` and `write(state, view) => string`. Parameters (decision 128): `focus`, `sel`, `pins` (comma-separated IDs), `view` (A, B, or C), `votes` (Vote Limit), `hide` (comma-separated node types turned off), `books` (comma-separated OSIS codes, or `build` for "only books in this build"). Defaults are left out, so Abraham with default filters is the bare address. Unknown IDs and bad values are dropped with a notice. Your Path is not in the address. A Focus change pushes a history entry; everything else replaces the current one; Back and Forward apply the stored Focus as a `focus` action. Document the format in the spec's reference copy and keep it stable.
2. **Focus Model (changed).** `filters` gains `hidden: NodeType[]` and `books: string[] | "all" | "build"`. A hidden type, and a Verse outside the chosen books, are left out of Ring 1, Overflow counts, Ring 2, pin rings, Shared Nodes, and `passes` (used by the Neighbour lists). A chosen book keeps its chapters outside the build; only `build` hides them. The book filter does not apply to the "Together in N verses" lists (decision 136). The Focus and Pinned Nodes are never hidden by a filter. Selection is not changed by a filter. `relationWords(owner, link, genderOf, of?)`, built on `relation`, gives the Relationship words the Neighbour lists, the Relationship line, and the Focus to Selected Node edge show: words that never vary for the pair of node types are dropped, so a Verse and an Entity it names or is filed under, and a People Group and its member, show nothing, two Verses show "N votes", and pairs that only ever link by Co-mention show "N verses" (decision 141). Hover titles keep the full words.
3. **Data loader (changed).** Adds the chapter of a Verse (for the reader panel), the linked Verses of an Entity in Bible order, an Entity's facts with their sources, and the build's book and chapter list (already used by `outside`).
4. **Correction link (new, pure).** `correctionLink({ nodeIds, kind, currentValue, dataVersion, pageUrl }) => string` builds the issue form address with the template and the stable field IDs (`kind`, `node_ids`, `current_value`, `data_version`, `page_url`). The repository address comes from `credits.json`'s curated tables link, so it is not repeated in code.
5. **Journey notes (new).** Notes are a map from node ID to text, kept in browser storage with the M3 storage wrapper (decision 129). Your Path and the Focus are also kept in browser storage, so a reload restores the session; the address still wins when it names a Focus. `notesMarkdown(steps, notes, label, type, link, date) => string` builds the download: a title with the date, then one numbered heading per step, oldest first, ending with the Focus; each with the node's name and type, the note (or nothing), and a link to the page address with that node as the Focus. A step with no note is still listed, so the file reads as the journey.
6. **Reader panel (new component).** Loads the chapter of the Selected Verse, or of the Focus's first linked Verse when "Read" is pressed on an Entity. Verse numbers are buttons with the same click and double click rules as the lists (two clicks within 400 ms, decision 24).
7. **Detail panel (changed).** Adds the sections in the Solution, each item with its source and licence in its hover title (decision 139), curated items with note and Evidence Verses (decision 75 shape), corrections from an Entity's `corrections` list, and the correction links.
8. **Filter panel (new component).** Type toggles in the type colours, the Vote Limit slider with the PRD 10.1 text, the book filter, and the animation switch (which, with `prefers-reduced-motion`, turns off the camera flight and growth).
9. **Credits page (new entry).** A separate page in the front end build, like the node limit page, rendered from `credits.json`.

### Rules decided here

- **Book filter** (decision 130): it applies to Verses only, not Entities. Its choices are each book in the build, "Verses outside this build", and all. The default is all, so the M3 behaviour is kept unless the reader chooses otherwise.
- **Correction channel** (decisions 131 and 145): the GitHub issue form, and beside it a `mailto:` link to contact@wendtheword.flying-ant.uk with the same fields in its body (PRD 10.5). The dialog says how emails are handled before the reader writes. While the repository is private (decision 47) the form opens only for the owner; that is accepted until M5.
- **Notes stay in the browser** (decision 112, PRD 3): no account, no server, no Worker. Deleting all notes asks for confirmation.
- **Credits page as its own entry** (decision 132): it needs no state from the main page and must load without WebGL.

### Page address format

Stable (decision 128): links shared now must still open after later releases, so a parameter may be added but never renamed, and a value's meaning never changes. Read and written by `web/src/address.ts`.

`/?focus=person:isaac_616&sel=place:gerar_459&pins=person:abraham_58,Gen.26.1&view=B&votes=5&hide=event,theme&books=build`

| Parameter | Value | Default (left out) |
|---|---|---|
| `focus` | The Focus: an Entity ID (`person:isaac_616`) or a Verse, written as its OSIS reference with dots (`Gen.25.1`, decision 149) | `person:abraham_58`, but a shared link always names it (decision 134) |
| `sel` | The Selected Node: an Entity ID, a Verse, or an Overflow Node (`overflow:person`) | the Focus |
| `pins` | Pinned Nodes (Entity IDs or Verses), comma-separated, in pin order, at most 3 | none |
| `view` | `A` (tilted plane), `B` (stacked discs), or `C` (free orbit) | the view kept in this browser, else `A` |
| `votes` | The Vote Limit, a whole number | `1` |
| `hide` | Node types turned off, comma-separated, in the order `person`, `place`, `event`, `group`, `theme`, `verse` | none |
| `books` | The book filter (decision 130): `build` for the Verses in this build, or the OSIS codes (`Gen`) of books in this build, comma-separated, whose Verses show | all books |

- Parameters are written in the order above. Colons and commas in IDs are not escaped; a reader of the address decodes it as usual form encoding, so escaped forms work too.
- A Verse is written `Gen.22.2`, which needs no encoding. `focus`, `sel`, and `pins` also read a Verse as its Verse Key (`01022002`, the form written before decision 149, so older links keep working) and in any form the search box accepts (`Gen 22:2`, `Gen22:2`, `Genesis 22:2`).
- With every default, the page's own address is the bare page: Abraham with default settings. The bare address names no Focus, so it restores the Focus and Your Path kept in this browser (decision 133). A shared link ("Copy link", the notes download, a correction request) always names the Focus (decision 134).
- A parameter that is not recognised (an ID not in this build, a Verse outside the built chapters, a Verse number its chapter does not have, a view other than A, B, or C, votes that are not a whole number, a fourth pin, an unknown node type, a book not in this build) is left out and named in a notice. A node value that is neither an ID nor a Verse in any form gets a notice that says what was expected: "0102200 is not a Verse here. Write a Verse as Gen.22.2 or Gen 22:2." A missing or unknown Focus opens on the Focus kept in this browser, else Abraham. Unknown parameter names are ignored.
- A `view` in the address wins over the view kept in this browser.
- Your Path is not in the address.
- History: a Focus change pushes a new entry; a selection, pin, view, or filter change replaces the current one. Back and Forward make the entry's Focus the Focus again; the Selected Node, pins, view, and filters stay as they are.

## Testing Decisions

- **The same seams as M3** (#18): Vitest on pure modules and the Focus Model, fed by the export built from the fixture sources; Playwright on the built page with the fixture export, in the e2e build mode. The build seam is used only if a data change turns out to be needed.
- **What makes a good test here.** It states a rule a reader could check: "opening `?focus=person:isaac_616&view=B` shows Isaac in the stacked discs", "a hidden type leaves Ring 1 and its Overflow Node", "the download lists the steps oldest first and ends with the Focus", "the correction link fills `node_ids`". It does not check component internals, storage keys, or three.js objects.
- **Vitest cases:** URL state round trip, defaults left out, unknown IDs and bad values dropped with a notice; type and book filters across Ring 1, Overflow counts, Ring 2, pin rings, Shared Nodes and the node limit, never hiding the Focus or pins; correction link for a node, a Relationship (two IDs), a fact, and a linked Verse, and the correction email with the same fields; notes Markdown for an empty journey, notes on some steps, and a cleared and restored Your Path.
- **Playwright cases:** open a shared address in each view; Back and Forward between Foci; reader panel select and double click, chapter buttons, outside-build Verse; detail panel shows a correction note and a curated Evidence Verse (fixture: Anah's gender correction, the Anah and Beeri link); filter changes reach the scene and the address; a note survives a reload and the download contains it; the credits page lists every source in `credits.json`; the page works with animation off.
- **Prior art.** M3's tests in the front end package (model, data, search, and the journey spec), and `tests/conftest.py` with `tests/test_search_and_credits.py` for the build seam and credits.

## Out of Scope

- The phone layout, including the reader panel as a bottom sheet tab (M7).
- The Cloudflare deploy of the product and the repository going public (M5).
- The whole Bible (M6). The book filter and reader panel must work for many books, but only Genesis ships.
- Full text search of Verses, the NLT, word study, and a second text (phase 2).
- Accounts, server storage, or syncing notes between devices.
- A first-run tour (decision 120, M5 ticket).

## Further Notes

1. **Decisions 127 to 132** record the choices in this spec: the reader panel as a left drawer (owner), the address format (proposed here), journey notes in the browser with a Markdown download (owner), the book filter, the GitHub-only correction channel for now (owner), and the credits page as its own entry.
2. **Your Path across reloads.** The glossary defines Your Path as "this session". Keeping it in browser storage so that notes have their steps after a reload stretches "session" to "this browser until cleared". If the owner prefers a strict session, Your Path can live in session storage instead; notes stay in browser storage either way.
3. **Gen 36:25.** The Anah of Gen 36:25 ("These are the children of Anah: Dishon and Oholibamah") is linked by Theographic to the son of Seir; it may belong to the son of Zibeon of Gen 36:24. It is a candidate for the first real Correction Request through the M4 link.
4. **Node limit.** Still 500 on desktop (decision 123); a mid-range laptop test is due before M5.
