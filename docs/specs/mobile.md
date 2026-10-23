# M7: the mobile release

## Problem Statement

Wend Through the Word is built for a desktop with a mouse and a keyboard. On a phone the detail panel, the reader drawer, the search box, and the filter panel crowd the scene; a tap cannot hover, so names and relationship words that appear on hover cannot be reached; and the scene may hold more nodes than a phone can draw smoothly. A student who opens a shared link on a phone, or wants to study on the bus, cannot walk the journey comfortably. On a tablet the layout fits, but the same hover problem applies to touch.

## Solution

The site adapts to the screen and the input. On a phone (640 px wide or less) the panel becomes a bottom sheet with Details and Reader tabs, search opens from a button, the filters and Vote Limit live in the sheet, and the scene is centred in the space above the sheet. Touch works everywhere: a tap selects, a double tap makes the Focus, a drag moves the camera, and a pinch zooms; anything that appears on hover on a desktop appears on the Selected Node after a tap. A phone draws at most 500 nodes, the same node limit as a desktop (decision 177, measured on a real phone), and offers views A (the tilted plane, the default) and C (the free orbit). A tablet keeps the desktop layout with touch input. The desktop experience does not change.

## User Stories

1. As a student on a phone, I want the scene to fill the screen above a bottom sheet, so that I can see the graph and the details at once.
2. As a student on a phone, I want to open and close the bottom sheet from a handle on its top edge, so that I can give the scene the whole screen when I explore.
3. As a student on a phone, I want the sheet to open at about half the screen's height, so that the scene above it stays usable.
4. As a student on a phone, I want the scene's centre to move into the space above the sheet, so that the Focus is never hidden behind it.
5. As a student on a phone, I want a Details tab in the sheet, so that I can read about the Selected Node.
6. As a student on a phone, I want a Reader tab in the sheet, so that I can read the chapter of the Selected Verse.
7. As a student on a phone, I want the sheet to remember which tab I last used, so that I do not switch back every time.
8. As a student on a phone, I want a tap on a node to select it, so that the sheet shows its details without moving the scene.
9. As a student on a phone, I want a double tap on a node to make it the Focus, so that I can move through the graph as on a desktop.
10. As a student on a phone, I want the Make Focus button in the sheet, so that I can move the Focus without a double tap.
11. As a student on a phone, I want a drag on the scene to move the camera in the current view, so that I can look around.
12. As a student on a phone, I want a pinch to zoom the scene, so that I can make room for hidden names.
13. As a student on a phone, I want the Selected Node's name and its relationship words to show after a tap, so that I get what a desktop shows on hover.
14. As a student on a phone, I want a hidden name to appear when I tap its node, so that crowded names are still reachable (decision 124).
15. As a student on a phone, I want a search button that opens the search box over the scene, so that search does not take space when I do not need it.
16. As a student on a phone, I want search to close after I choose a result, so that I return to the scene at once.
17. As a student on a phone, I want the on-screen keyboard to open when search opens, so that I can type at once.
18. As a student on a phone, I want the filters, including the Vote Limit slider and its explanation, in the sheet, so that they do not cover the scene.
19. As a student on a phone, I want the book filter in the sheet, so that I can limit Verses to a book.
20. As a student on a phone, I want Your Path as a compact bar that scrolls sideways, so that it fits a narrow screen.
21. As a student on a phone, I want to tap a step of Your Path to select it, so that I can go back without the Prev button.
22. As a student on a phone, I want Prev, Next, Pin, Read, and Suggest a correction in the sheet, so that every desktop action is there.
23. As a student on a phone, I want the lists in the sheet to page as on a desktop, so that a long list does not freeze the page.
24. As a student on a phone, I want a double tap on a list row to make it the Focus, so that the lists work as on a desktop.
25. As a student on a phone, I want a list row not to move between my two taps, so that a double tap lands on the row I meant.
26. As a student on a phone, I want to choose between the tilted plane and the free orbit, so that I can use the view I prefer.
27. As a student on a phone, I want the tilted plane by default, so that I see the most names on a small screen (decision 118).
28. As a student on a phone with the stacked discs saved from a desktop or a shared link, I want the tilted plane instead, so that I never get the most crowded view on a small screen.
29. As a student on a phone, I want the scene to hold at most the node limit, so that it stays smooth (one limit, 500, measured on a phone: decision 177).
30. As a student on a phone, I want the hidden-nodes note to say how many nodes the limit trimmed, so that I know the scene is not complete (decision 33).
31. As a student on a phone, I want the Focus label without its dictionary subtitle, so that it does not cover Ring 1.
32. As a student on a phone, I want the tour to work by touch, with its box placed where it does not cover the sheet or its target, so that I can learn the site on a phone.
33. As a student on a phone, I want the tour's camera step to say drag and pinch, so that it matches my input.
34. As a student on a phone, I want the tour to point at the search button when search is closed, so that I can find it.
35. As a student on a phone, I want a shared link to open the same Focus, selection, pins, and filters as on a desktop, so that sharing works across devices.
36. As a student on a phone, I want a shared link with the stacked discs to open in the tilted plane, so that the link still works.
37. As a student on a phone, I want my notes and Your Path kept in this browser as on a desktop, so that a reload does not lose them.
38. As a student on a phone, I want the correction dialog to fit the screen, so that I can suggest a correction.
39. As a student on a phone, I want the credits page to read well on a narrow screen, so that I can see the sources.
40. As a student on a phone, I want the no-WebGL fallback lists to work by touch, so that an old phone can still use the site.
41. As a student on a phone, I want buttons large enough to tap, so that I do not hit the wrong one.
42. As a student on a phone, I want the page not to zoom or scroll sideways when I pinch the scene or type in search, so that the layout stays put.
43. As a student on a phone, I want the sheet to stay above the on-screen keyboard while I type a note, so that I can see what I type.
44. As a student on a phone turned sideways, I want the layout to follow the new width, so that landscape works too.
45. As a student on a tablet, I want the desktop layout with touch input, so that I get the side panels on a wide screen.
46. As a student on a tablet, I want tap, double tap, drag, and pinch to work as on a phone, so that I need no mouse.
47. As a student on a tablet, I want names and words that show on hover on a desktop to show after a tap, so that touch reaches them.
48. As a student using a mouse on a desktop, I want nothing to change, so that my habits still work.
49. As a student with a narrow desktop window, I want the phone layout, so that a small window stays usable.
50. As the owner, I want to measure the node limit on a real phone with the node limit test page, so that the limit is a measured value (PRD 11).
51. As the owner, I want a way to open the local build on my phone over my home network, so that I can run the test without deploying the test page (decision 156).
52. As the owner, I want the phone limit recorded as a decision with the device and the frame rates, so that it can be checked later.
53. As the owner, I want browser tests that walk the phone journey by touch, so that a change that breaks the phone fails CI.
54. As the owner, I want browser tests at a tablet size with touch, so that the touch rules hold with the desktop layout.
55. As the owner, I want every existing desktop test to keep passing, so that M7 does not break the desktop release.
56. As the owner, I want the live check to pass after the M7 release, so that the deploy is known to work.

## Implementation Decisions

- **Breakpoint.** The phone layout applies at 640 px wide or less (decision 115), whatever the device; a narrow desktop window gets it too. A touch screen under 500 px tall (a phone on its side) gets it as well, and on a screen wider than it is tall the sheet docks on the right (decision 184, which replaces 181). Other wider screens keep the desktop layout. The breakpoint is one value shared by the layout (CSS) and the logic (the views; the node limit does not change at it, decision 177).
- **Input.** Touch rules follow the input, not the width: a coarse pointer (no hover) gets tap-to-show for what a desktop shows on hover; a fine pointer keeps hover. A tablet is a wide screen with a coarse pointer.
- **Bottom sheet.** On a phone the detail panel and the reader become one bottom sheet with a handle and two tabs, Details and Reader. The reader component is already built not to assume where it is mounted (decision 127); it moves into the sheet unchanged. The sheet opens at 46% of the height (prototype finding), can be closed to its handle, and remembers the last tab in browser storage. Its top row holds the tabs and the handle, with no gap above the tabs; a tap on the handle opens and closes it (open is half), a tab tapped on a closed sheet opens it, and a drag on the row follows the finger and on release snaps to the nearest of closed (the row only), half, and full (all but the top bar and an 80 px strip of the scene); Up and Down on the handle step through the same heights. The camera offset follows the height once the drag ends (owner's second phone test). The sheet's bottom edge sits at the bottom of the visual viewport, so neither the on-screen keyboard nor a browser toolbar covers it, and at 325 x 600 the Selected Node's actions are inside the open sheet. The scene is offset so its centre sits in the space above the sheet (a camera view offset, prototype rule 6). On a screen wider than it is tall the sheet is a full-height side panel on the right, about 40% of the width, its handle at the start of the tab row, and the offset moves the centre sideways instead (decision 184); it does not drag. Whenever the sheet opens, closes, or snaps to another height (or the side sheet opens or closes, or the phone turns), the camera eases so the Focus is in the middle of the free scene, undoing a drag, a pinch's pan, or a tour's pan, and keeping the zoom (decision 188).
- **Recentre.** A round Recentre button, on every screen, puts the camera back at the view's start round the Focus, in the middle of the free scene, undoing pans, zooms, and turns; the Focus, the Selected Node, and Your Path stay (decision 188). It sits in the scene's top left corner: on a phone just below the top bar, 44 px; on a desktop below the search box, level with the top of the reader drawer and right of it when the drawer is open, 32 px (44 px on a touch screen). The tour box keeps clear of it.
- **Search.** On a phone search is a button that opens the search box over the top of the scene and focuses it; it closes after a choice or on Escape or a tap outside.
- **Filters.** On a phone the filter panel (node types, Vote Limit with its explanation, book filter) is a section of the Details tab, not a floating panel. The view picker, Filters, and Copy link are a row at the top of the Details tab, Filters and Copy link as icons with the same names; a notice shows above the sheet for a few seconds, then fades (decision 183).
- **Your Path bar.** On a phone it is one row that scrolls sideways; Clear and Undo clear stay at its end. With the search icon at its end it is one slim top bar, 40 px tall; the scene has everything between it and the sheet (decision 183).
- **Double tap in lists.** The Selected Node section keeps its fixed height on a phone too (40% of the sheet), so a list row does not move between two taps and the double click rule (decision 148) holds. Make Focus remains the alternative. This settles the prototype's open question 4 in favour of the fixed height.
- **Tap and double tap on the scene.** The scene's existing pointer handling (two taps within 400 ms on one node are a double tap) covers touch; a tap on empty space does nothing; a drag that moves more than a few pixels is a camera move, not a tap.
- **Camera.** OrbitControls' touch gestures: one finger rotates or pans as the view's drag does on a desktop, two fingers pinch to zoom. The page itself does not zoom or scroll on the scene (touch-action none on the scene) and the viewport meta prevents a zoom on focusing an input.
- **Views on a phone.** Views A and C only. The view choice shows two options on a phone. A saved or shared view B opens as A on a phone, without changing the saved value, so the desktop still gets B.
- **Node limit.** One node limit, 500, on every screen (decision 177, which amends this spec's placeholder phone limit of 150): the real-phone test drew 500 nodes at 59 frames per second or more in every view, so nothing switches at the breakpoint and a shared link shows the same scene everywhere. The Focus Model reads the limit from the filters as today, and the trimming order does not change (decision 33). A phone limit, if a slower phone ever needs one, is a decision first.
- **Ring 1 size.** K stays 6 on a phone. K = 4 is held in reserve (prototype finding 3) and is not built unless the real-phone test or the owner asks for it.
- **Decluttering.** The rules of decision 124 already apply everywhere. On a phone the Focus label drops its dictionary subtitle (prototype rule 7). On a coarse pointer a tapped node's name and its relationship words show as a hovered node's do.
- **Tour.** The tour works on a phone: its box is placed so it covers neither the sheet nor the step's target (for a name in the scene, the ring goes round the node's disc and its name together, from the graph module's `nodeRect`, and the box keeps clear of both, checked at 325 x 600 in views A and C; decision 187 makes this every screen's rule, with the camera panning the node clear when no place for the box is, a pan undone when the step or the tour ends, decision 188), its camera step names drag and pinch on a coarse pointer, and a step whose target is hidden on a phone (the search box) points at the search button. Before each step it opens or closes the sheet and chooses its tab as the target needs (a name in the scene: closed; a target in the sheet: open at its tab), scrolls the target into view, and gives the reader's sheet and tab back at the end (decision 185). The tour's steps and order do not change.
- **Hit targets.** Buttons and list rows on a phone are at least 44 px tall.
- **Real-phone test.** The node limit test page stays local (decision 156). For the test, the preview server is started on the local network so a phone on the same Wi-Fi can open it; the runbook gains the steps. The result is recorded as a decision, like decisions 123 and 150; it is decision 177.
- **No data change.** M7 changes only the front end; the export and its data version are unchanged.

## Testing Decisions

- A good test drives the page as a reader does (taps, double taps, pinches, typing) and asserts on what the reader sees: the Focus and the Selected Node, the open tab, the names on screen, the address. It does not assert on component internals or CSS values except where a rule is about layout (the sheet's height, the scene's offset, hit target size).
- **Browser tests (Playwright), the main seam.** Two new projects beside the existing desktop one, all on the fixture export with software WebGL as in CI:
  - **Phone:** a phone device profile, 390 x 844, touch enabled. New specs: the phone journey by touch (search from the button, tap selects, double tap and Make Focus, sheet tabs, the reader in the sheet, pins, Your Path, notes), views A and C only with B opening as A, the hidden-nodes note under a low node limit, decluttering on tap, the tour by touch, a shared link opened on a phone.
  - **Tablet:** a tablet profile, 820 x 1180, touch enabled, desktop layout: tap shows hover names and words, double tap, pinch, and the desktop panels.
  - The existing desktop specs keep running unchanged in the desktop project; the phone and tablet projects run only their own specs.
  - Prior art: the existing specs (journey, select, declutter, tour, views, address) and their scene helpers, which read the drawn scene through the e2e test hook.
- **Focus Model unit tests (Vitest).** The node limit's trimming with pins and Your Path, through the existing scene and reduce seams, as before: with one limit (decision 177) there is no phone limit to test.
- **Staged site and live check.** Unchanged; they must still pass on the M7 release.
- **Manual.** The real-phone frame rate test, run by the owner, as for the desktop limit.

## Out of Scope

- Native mobile apps (PRD 1).
- K = 4 on a phone, unless the real-phone test calls for it.
- A different tour for phones; the same steps, adapted placement and wording.
- Offline use, installable web app features, and push notifications.
- Gestures beyond tap, double tap, drag, and pinch (no long press, no swipe between Verses).
- Any change to the data, the pipeline, or the export.
- The whole-graph overview (PRD open question 12), after M7.

## Further Notes

- Decisions carried in: 115 (phone layout from the prototype), 118 (view A default), 124 (decluttering everywhere), 127 (the reader as a component for the sheet), 148 (fixed-height section for the double click rule), 150 (desktop limit 500), 156 (the test page stays local). Decided during M7: 177 (one node limit, 500, no phone limit), 178 to 182 (the phone layout after review), 183 to 185 (the phone layout after the owner's test on a phone; 184 replaces 181), and 188 (the view follows the sheet, and a Recentre button).
- Owner decisions for this spec (2026-10-22): spec first with 150 as a placeholder phone limit, the real-phone test as the first ticket (it set one limit of 500, decision 177); views A and C only on a phone; a tablet test project with the desktop layout and touch.
- The prototype on branch `prototype/navigation` has the bottom sheet, search button, and phone decluttering as a working reference.
