// The first-run tour of studying Jesus Christ (decisions 120, 155, and 174), lifted from the prototype's guide on
// prototype/navigation. Each step is data: what it points at, what it asks, a check that the reader
// did it, and a "Do it for me" that uses the page's own actions or its own buttons.
import type { Data } from "./data";
import { TYPE_NAME, typeOf, typePlural, type Action, type Id, type State, type View } from "./model";
import type { Notes } from "./session";
import { TILES } from "./tiles";

// What a step can see and do. The reads are live: a step reads them after its own actions.
export type TourPage = {
  readonly data: Data;
  readonly model: State;
  readonly view: View;
  // A coarse pointer (touch) taps instead of clicking, and has no wheel to scroll.
  readonly coarse: boolean;
  readonly reading: Id | undefined;
  readonly notes: Notes;
  apply(a: Action): void;
  makeFocus(id: Id): Promise<void>;
  pin(id: Id): Promise<void>;
  read(): void;
  note(id: Id, text: string): void;
  // A drawn node's disc on the page, or null.
  nodeRect(id: Id): DOMRect | null;
  // Pans the scene so a drawn node's disc centre lies at (x, y) on the page, zoomed out by zoomOut.
  panTo(id: Id, x: number, y: number, zoomOut: number): void;
  // Eases back the pans and zoom panTo made, when a step or the tour ends (decision 188).
  panBack(): void;
};
// at: the model and notes when the step began, and whether the camera has moved since.
export type At = { model: State; notes: Notes; moved: boolean };
export type Step = {
  title: string;
  text: (p: TourPage) => string;
  target: (p: TourPage) => Element | null | undefined;
  // The node in the scene the step asks the reader to tap, wherever its ring is: the box keeps clear
  // of its disc and name too (decision 187).
  node?: (p: TourPage) => Id;
  check: (p: TourPage, at: At) => boolean;
  act: (p: TourPage) => unknown;
};

// The tour starts at John 1:1, where the Word is with God.
export const TOUR_START = "43001001";
const JESUS = "person:jesus_905",
  GOD = "person:god_1324",
  PETER = "person:peter_2745",
  MIRACLES = "theme:miracles",
  BETHLEHEM = "place:bethlehem_218";

// The components mark each target with data-tour; a name in the scene carries its node ID.
const one = (s: string) => document.querySelector(s);
const tour = (name: string) => one(`[data-tour="${name}"]`);
const label = (id: Id) => one(`[data-tour="scene"] [data-node="${id}"]`);
// A label the scene hides as crowded (decision 124) cannot be pointed at.
const shown = (el: Element | null) => (el?.checkVisibility({ visibilityProperty: true }) ? el : null);
const onPath = (s: State) => [...s.path, s.focus];
// Waits a few frames for the panel to draw what an action asked for.
async function drawn(find: () => Element | null | undefined) {
  for (let i = 0; i < 120 && !find(); i++) await new Promise(requestAnimationFrame);
  return find() as HTMLElement | undefined;
}

const CAMERA: Record<View, string> = {
  A: "In the tilted plane, drag to pan",
  B: "In the stacked discs, drag to spin the scene around its centre",
  C: "In the free orbit, drag to turn the scene any way",
};
// A touch screen taps where a mouse clicks (decision 182).
const click = (p: TourPage) => (p.coarse ? "tap" : "click");
const Click = (p: TourPage) => (p.coarse ? "Tap" : "Click");

export const STEPS: Step[] = [
  {
    title: "Move the camera",
    text: (p) => `The tour starts at John 1:1 with an empty Your Path and no pins. Your own Path, pins, and notes are set aside and come back when the tour ends. ${CAMERA[p.view]} and ${p.coarse ? "" : "scroll or "}pinch to zoom. Try it on the scene.`,
    target: (p) => label(p.model.focus),
    node: (p) => p.model.focus,
    check: (_, at) => at.moved,
    act: () => one('[data-tour="scene"] canvas')!.dispatchEvent(new WheelEvent("wheel", { deltaY: -240, bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight / 2 })),
  },
  {
    title: "Find Jesus Christ",
    text: () => 'Type "Jesus Christ" in the search box and choose him. A search result becomes the Focus, the centre of the scene.',
    target: () => tour("search"),
    check: (p) => p.model.focus === JESUS,
    act: (p) => p.makeFocus(JESUS),
  },
  {
    title: "Select God",
    text: (p) => `Ring 1 holds his closest Neighbours of each type, and the words on the lines say how each relates to him. ${Click(p)} God to select him: the scene stays and the panel shows God.`,
    target: () => label(GOD),
    node: () => GOD,
    check: (p) => p.model.selected === GOD,
    act: (p) => p.apply({ type: "select", id: GOD }),
  },
  {
    title: "Back to Jesus Christ",
    text: (p) => `Select Jesus Christ again: ${click(p)} him in the scene or in the Your Path bar at the top. The panel lists his Neighbours.`,
    target: () => label(JESUS),
    node: () => JESUS,
    check: (p) => p.model.selected === JESUS,
    act: (p) => p.apply({ type: "select", id: JESUS }),
  },
  {
    title: "Open his Themes",
    text: () => 'In the panel, press "more" under his Themes to list them all.',
    target: () => tour("more-theme"),
    check: () => tour("more-theme")?.getAttribute("aria-expanded") === "true",
    act: async (p) => {
      if (!tour("more-theme")) p.apply({ type: "select", id: JESUS });
      (await drawn(() => tour("more-theme")))?.click();
    },
  },
  {
    title: "Choose a Theme",
    text: () => "Select a Theme in his list, Miracles for one. Under its name the panel lists the Verses it shares with Jesus Christ, with their text.",
    target: () => tour("list-theme"),
    check: (p) => typeOf(p.model.selected) === "theme",
    act: (p) => {
      const themes = p.data.record(JESUS)!.links.filter((l) => l.type === "theme");
      p.apply({ type: "select", id: (themes.find((l) => l.id === MIRACLES) ?? themes[0]).id });
    },
  },
  {
    title: "Make Simon Peter the Focus",
    text: (p) => `Double ${click(p)} Simon Peter in the scene, or select him and press Make Focus, or search for him. The scene moves to him.`,
    target: (p) => (p.model.selected === PETER && tour("make-focus")) || shown(label(PETER)) || tour("search"),
    node: () => PETER,
    check: (p) => p.model.focus === PETER,
    act: (p) => p.makeFocus(PETER),
  },
  {
    title: "Pin Jesus Christ",
    text: (p) => `Jesus Christ joined Your Path, the bar at the top. ${Click(p)} him in the scene or in the Your Path bar to select him, then press Pin in the panel.`,
    target: (p) => (p.model.selected === JESUS && tour("pin")) || tour(`path-${JESUS}`),
    node: () => JESUS,
    check: (p) => p.model.pins.includes(JESUS),
    act: async (p) => {
      p.apply({ type: "select", id: JESUS });
      await p.pin(JESUS);
    },
  },
  {
    title: "Walk Your Path",
    text: () => "Rings mark the nodes Simon Peter shares with the pinned Jesus Christ. Press Prev or Next in the panel to walk Your Path; the Focus stays.",
    target: () => tour("next"),
    check: (p, at) => p.model.selected !== at.model.selected && onPath(p.model).includes(p.model.selected),
    act: (p) => {
      if (!onPath(p.model).includes(p.model.selected)) p.apply({ type: "select", id: p.model.focus });
      p.apply({ type: "step", dir: onPath(p.model).indexOf(p.model.selected) > 0 ? -1 : 1 });
    },
  },
  {
    title: "Clear Your Path",
    text: () => "Press Clear at the end of the Your Path bar. The Focus and pins stay.",
    target: () => tour("clear"),
    check: (p) => !!p.model.cleared,
    act: (p) => p.apply({ type: "clearPath" }),
  },
  {
    title: "Undo clear",
    text: () => "Press Undo clear to bring Your Path back.",
    target: () => tour("clear"),
    check: (p) => !p.model.cleared && p.model.path.length > 0,
    act: (p) => p.apply({ type: "undoClear" }),
  },
  {
    title: "Read",
    text: (p) => `Press Read in the panel. The reader panel opens at the Selected Node's first Verse; a ${click(p)} on a Verse there selects it.`,
    target: () => tour("read"),
    check: (p) => !!p.reading,
    act: (p) => p.read(),
  },
  {
    title: "Write a note",
    text: () => "Type a note in the box in the panel. Each step of Your Path can have one, kept in this browser only.",
    target: (p) => tour("note") ?? tour(`path-${p.model.focus}`),
    check: (p, at) => JSON.stringify(p.notes) !== JSON.stringify(at.notes),
    act: (p) => {
      if (!onPath(p.model).includes(p.model.selected)) p.apply({ type: "select", id: p.model.focus });
      p.note(p.model.selected, "Written in the tour.");
    },
  },
  {
    // Show map is pointed out, not pressed, so the tour asks nothing of the tile host (#88).
    title: `A ${TYPE_NAME.place} on a map`,
    text: (p) => `Show map, in the panel below the Selected Node's details, puts a ${TYPE_NAME.place} on a map. Its tiles come from ${TILES.name}, which sees your address, so it opens only when you press it; the tour leaves it shut. ${Click(p)} Jesus Christ in the Your Path bar, then Bethlehem, where he was born, in his ${typePlural("place")}.`,
    target: () => tour("show-map"),
    check: (p) => typeOf(p.model.selected) === "place",
    act: (p) => p.apply({ type: "select", id: BETHLEHEM }),
  },
];

// Where the tour box goes (decision 187). Rectangles on the page; a DOMRect is one.
export type Rect = { left: number; top: number; right: number; bottom: number };
type Size = { w: number; h: number };
export const apart = (a: Rect, b: Rect, m: number) => a.right + m <= b.left || b.right + m <= a.left || a.bottom + m <= b.top || b.bottom + m <= a.top;
const at = ([x, y]: number[], { w, h }: Size): Rect => ({ left: x, top: y, right: x + w, bottom: y + h });
// The places tried for the box's top left corner, in order: below, above, left of, and right of each
// rectangle kept clear, then the edges of the area beside them, then its corners.
function spots({ w, h }: Size, keep: Rect[], a: Rect, m: number) {
  const near = keep.map((r) => [Math.max(a.left, Math.min(a.right - w, r.left)), Math.max(a.top, Math.min(a.bottom - h, r.top)), r] as const);
  return [
    ...near.flatMap(([cx, cy, r]) => [[cx, r.bottom + m], [cx, r.top - m - h], [r.left - m - w, cy], [r.right + m, cy]]),
    ...near.flatMap(([cx, cy]) => [[cx, a.bottom - h], [cx, a.top], [a.left, cy], [a.right - w, cy]]),
    [a.left, a.bottom - h], [a.left, a.top], [a.right - w, a.top], [a.right - w, a.bottom - h],
  ];
}
const fits = (s: number[], size: Size, a: Rect) => {
  const r = at(s, size);
  return r.left >= a.left && r.top >= a.top && r.right <= a.right && r.bottom <= a.bottom;
};

// The first place in the area for a box of this size at least m from every rectangle kept clear, or
// undefined when there is none.
export function spotFor(size: Size, keep: Rect[], area: Rect, m: number) {
  return spots(size, keep, area, m).find((s) => fits(s, size, area) && keep.every((r) => apart(at(s, size), r, m)));
}

// When no place keeps clear of the step's node: a place for the box clear of the other rectangles
// kept clear, and the largest room the box leaves in the scene, beside it, for the node to be panned
// into; undefined when the box cannot keep clear of the others.
// The tallest the box can be, w px wide, in the area and m px clear of each fixed rectangle (the
// Recentre button, an open search panel): beside them, or in a band above, between, or below them.
// A box taller than its text needs is no taller for it; a shorter one scrolls its text.
export function tallest(w: number, fixed: Rect[], a: Rect, m: number) {
  const xs = [a.left, a.right - w, ...fixed.flatMap((f) => [f.right + m, f.left - m - w])].filter((x) => x >= a.left && x + w <= a.right);
  const tops = [a.top, ...fixed.map((f) => f.bottom + m)];
  let best = 0;
  for (const x of xs) {
    const across = fixed.filter((f) => f.left < x + w + m && x < f.right + m);
    for (const t of tops) {
      if (across.some((f) => f.top - m < t && t < f.bottom + m)) continue;
      best = Math.max(best, Math.min(a.bottom, ...across.filter((f) => f.top - m >= t).map((f) => f.top - m)) - t);
    }
  }
  return best;
}
export function makeRoom(size: Size, node: Rect, others: Rect[], area: Rect, scene: Rect, m: number) {
  let best: { spot: number[]; room: Rect } | undefined;
  const size2 = (r: Rect) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  for (const s of spots(size, [node, ...others], area, m)) {
    const b = at(s, size);
    if (!fits(s, size, area) || !others.every((r) => apart(b, r, m))) continue;
    const rooms: Rect[] = [
      { ...scene, bottom: Math.min(scene.bottom, b.top - m) },
      { ...scene, top: Math.max(scene.top, b.bottom + m) },
      { ...scene, right: Math.min(scene.right, b.left - m) },
      { ...scene, left: Math.max(scene.left, b.right + m) },
    ];
    const room = rooms.reduce((x, y) => (size2(y) > size2(x) ? y : x));
    if (!best || size2(room) > size2(best.room)) best = { spot: s, room };
  }
  return best;
}
