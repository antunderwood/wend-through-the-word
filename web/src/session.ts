// The session kept in this browser (decisions 129 and 133): Your Path with its Focus, and the
// journey notes. No DOM; storage goes through storage.ts, and restore() is pure.
import { START, type Asked } from "./address";
import { initialState, reduce, type Id, type State } from "./model";
import { store, stored } from "./storage";

const PATH_KEY = "wend.journey"; // the stored name stays, so a kept Path survives this release
const NOTES_KEY = "wend.notes";

export type KeptPath = { focus: Id; path: Id[] };
export const keptPath = (): KeptPath | null => JSON.parse(stored(PATH_KEY) ?? "null");
export const keepPath = (s: State) => store(PATH_KEY, JSON.stringify({ focus: s.focus, path: s.path }));

export type Notes = Record<Id, string>;
export const keptNotes = (): Notes => JSON.parse(stored(NOTES_KEY) ?? "{}");
export const keepNotes = (notes: Notes) => store(NOTES_KEY, JSON.stringify(notes));
// An emptied note is removed, so its step is no longer marked.
export function withNote(notes: Notes, id: Id, text: string): Notes {
  const { [id]: _, ...rest } = notes;
  return text ? { ...rest, [id]: text } : rest;
}

// The state the page opens on: Your Path and the Focus kept in this browser, less any node this build
// no longer has, else Abraham. The address wins when it names a Focus, and the kept Focus then joins
// Your Path, as on any move; the address also gives the selection, pins, filters, and notice.
export function restore(asked: Asked, kept: KeptPath | null, known: (id: Id) => boolean, label: (id: Id) => string): State {
  let s: State = { ...initialState(kept && known(kept.focus) ? kept.focus : START), path: kept?.path.filter(known) ?? [] };
  if (asked.focus) s = reduce(s, { type: "focus", id: asked.focus }, label);
  return { ...s, selected: asked.selected ?? s.focus, pins: asked.pins ?? [], filters: { ...s.filters, ...asked.filters }, notice: asked.notice ?? "" };
}
