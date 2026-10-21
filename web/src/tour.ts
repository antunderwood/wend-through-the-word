// The first-run tour of studying Abraham (decisions 120 and 155), lifted from the prototype's guide on
// prototype/navigation. Each step is data: what it points at, what it asks, a check that the reader
// did it, and a "Do it for me" that uses the page's own actions or its own buttons.
import type { Data } from "./data";
import { typeOf, type Action, type Id, type State, type View } from "./model";
import type { Notes } from "./session";

// What a step can see and do. The reads are live: a step reads them after its own actions.
export type TourPage = {
  readonly data: Data;
  readonly model: State;
  readonly view: View;
  readonly reading: Id | undefined;
  readonly notes: Notes;
  apply(a: Action): void;
  makeFocus(id: Id): Promise<void>;
  pin(id: Id): Promise<void>;
  read(): void;
  note(id: Id, text: string): void;
};
// at: the model and notes when the step began, and whether the camera has moved since.
export type At = { model: State; notes: Notes; moved: boolean };
export type Step = {
  title: string;
  text: (p: TourPage) => string;
  target: (p: TourPage) => Element | null | undefined;
  check: (p: TourPage, at: At) => boolean;
  act: (p: TourPage) => unknown;
};

// The tour starts at Gen 11:27, where Abram is born into the account of Terah.
export const TOUR_START = "01011027";
const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  ISAAC = "person:isaac_616";

// The components mark each target with data-tour; a name in the scene carries its node ID.
const one = (s: string) => document.querySelector(s);
const tour = (name: string) => one(`[data-tour="${name}"]`);
const label = (id: Id) => one(`[data-tour="scene"] [data-node="${id}"]`);
const onPath = (s: State) => [...s.path, s.focus];
// Waits a few frames for the panel to draw what an action asked for.
async function drawn(find: () => Element | null | undefined) {
  for (let i = 0; i < 120 && !find(); i++) await new Promise(requestAnimationFrame);
  return find() as HTMLElement | undefined;
}

const CAMERA: Record<View, string> = {
  A: "In the tilted plane, drag to pan and scroll or pinch to zoom.",
  B: "In the stacked discs, drag to spin the scene around its centre and scroll or pinch to zoom.",
  C: "In the free orbit, drag to turn the scene any way and scroll or pinch to zoom.",
};

export const STEPS: Step[] = [
  {
    title: "Move the camera",
    text: (p) => `The tour starts at Gen 11:27 with Your Path empty and no pins; yours come back when it ends. ${CAMERA[p.view]} Try it on the scene.`,
    target: (p) => label(p.model.focus),
    check: (_, at) => at.moved,
    act: () => one('[data-tour="scene"] canvas')!.dispatchEvent(new WheelEvent("wheel", { deltaY: -240, bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight / 2 })),
  },
  {
    title: "Find Abraham",
    text: () => 'Type "Abraham" in the search box and choose him. A search result becomes the Focus, the centre of the scene.',
    target: () => tour("search"),
    check: (p) => p.model.focus === ABRAHAM,
    act: (p) => p.makeFocus(ABRAHAM),
  },
  {
    title: "Select Sarah",
    text: () => "Ring 1 holds his closest Neighbours of each type, and the words on the lines say how each relates to him. Click Sarah to select her: the scene stays and the panel shows her.",
    target: () => label(SARAH),
    check: (p) => p.model.selected === SARAH,
    act: (p) => p.apply({ type: "select", id: SARAH }),
  },
  {
    title: "Back to Abraham",
    text: () => "Select Abraham again: click him in the scene or in the Your Path bar at the top. The panel lists his Neighbours.",
    target: () => label(ABRAHAM),
    check: (p) => p.model.selected === ABRAHAM,
    act: (p) => p.apply({ type: "select", id: ABRAHAM }),
  },
  {
    title: "Open his Themes",
    text: () => 'In the panel, press "more" under his Themes to list them all.',
    target: () => tour("more-theme"),
    check: () => tour("more-theme")?.getAttribute("aria-expanded") === "true",
    act: async (p) => {
      if (!tour("more-theme")) p.apply({ type: "select", id: ABRAHAM });
      (await drawn(() => tour("more-theme")))?.click();
    },
  },
  {
    title: "Choose a Theme",
    text: () => "Select a Theme in his list, Faith for one. Under its name the panel lists the Verses it shares with Abraham, with their text.",
    target: () => tour("list-theme"),
    check: (p) => typeOf(p.model.selected) === "theme",
    act: (p) => p.apply({ type: "select", id: p.data.record(ABRAHAM)!.links.find((l) => l.type === "theme")!.id }),
  },
  {
    title: "Make Isaac the Focus",
    text: () => "Double click Isaac in the scene, or select him and press Make Focus. The scene moves to him.",
    target: (p) => (p.model.selected === ISAAC && tour("make-focus")) || label(ISAAC),
    check: (p) => p.model.focus === ISAAC,
    act: (p) => p.makeFocus(ISAAC),
  },
  {
    title: "Pin Abraham",
    text: () => "Abraham joined Your Path, the bar at the top. Click him there to select him, then press Pin in the panel.",
    target: (p) => (p.model.selected === ABRAHAM && tour("pin")) || tour(`path-${ABRAHAM}`),
    check: (p) => p.model.pins.includes(ABRAHAM),
    act: async (p) => {
      p.apply({ type: "select", id: ABRAHAM });
      await p.pin(ABRAHAM);
    },
  },
  {
    title: "Walk Your Path",
    text: () => "Rings mark the nodes Isaac shares with the pinned Abraham. Press Prev or Next in the panel to walk Your Path; the Focus stays.",
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
    text: () => "Press Read in the panel. The reader panel opens at the Selected Node's first Verse; a click on a Verse there selects it.",
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
];
