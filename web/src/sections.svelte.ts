// The sections of one Selected Node, the same list whichever way it is shown (decision 238): the
// side panel or sheet stacks them under a row of chips that scroll to each, and the HUD shows one
// at a time as tabs. Which the node has depends only on the node, the Focus and the data.
import type { Data } from "./data";
import { typeOf, type Id, type State } from "./model";

export type SectionId = "overview" | "links" | "verses" | "map" | "note";
export type Section = { id: SectionId; name: string };

const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));

/** The sections this node has, in the order of the chips and tabs; the overview always. */
export function sectionsOf(data: Data, model: State, routed: boolean): Section[] {
  const { selected, focus } = model;
  return [
    { id: "overview", name: "Overview" },
    ...(data.outside(selected) ? [] : [{ id: "links" as const, name: "Links" }]),
    ...(isEntity(selected) && isEntity(focus) ? [{ id: "verses" as const, name: "Verses" }] : []),
    ...(routed ? [{ id: "map" as const, name: "Map" }] : []),
    ...(selected === focus || model.path.includes(selected) ? [{ id: "note" as const, name: "Note" }] : []),
  ];
}

/** Whether the Selected Node has UBS routes (decision 220), which draw on the map. Make it while a component is initialised. */
export class Routed {
  #id = $state("");
  constructor(data: () => Data, selected: () => Id) {
    $effect(() => {
      const id = selected();
      if (this.#id !== id) this.#id = "";
      if (isEntity(id)) {
        data()
          .routes(id)
          .then((r) => id === selected() && r.length && (this.#id = id))
          .catch(() => {});
      }
    });
  }
  /** True when the given node is the one with routes. */
  for(id: Id) {
    return this.#id === id;
  }
}
