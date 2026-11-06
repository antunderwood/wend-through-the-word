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

// Notes kept under a published ID that was replaced move to the new ID (joined to any note already
// there); a note on a removed ID stays as it is, so nothing the reader wrote is lost (decision 215).
export function followNotes(notes: Notes, follow: (id: Id) => Id | null): Notes {
  const out: Notes = {};
  for (const [id, text] of Object.entries(notes)) {
    const to = follow(id) ?? id;
    out[to] = out[to] ? `${out[to]}\n\n${text}` : text;
  }
  return out;
}

// The state the page opens on: Your Path and the Focus kept in this browser, each moved to the ID that
// replaced it (decision 215), less any node this build no longer has, else Jesus Christ. The address
// wins when it names a Focus, and the kept Focus then joins Your Path, as on any move; the address
// also gives the selection, pins, filters, and notice.
export function restore(
  asked: Asked,
  kept: KeptPath | null,
  known: (id: Id) => boolean,
  label: (id: Id) => string,
  follow: (id: Id) => Id | null = (id) => id,
): State {
  const here = (id: Id) => {
    const to = follow(id);
    return to && known(to) ? to : undefined;
  };
  const focus = kept && here(kept.focus);
  // Two old IDs may now be one: a step keeps its latest place, and never repeats the Focus.
  const steps = (kept?.path ?? []).map(here).filter((id): id is Id => !!id);
  const path = steps.filter((id, i) => id !== (focus ?? START) && steps.lastIndexOf(id) === i);
  let s: State = { ...initialState(focus ?? START), path };
  if (asked.focus) s = reduce(s, { type: "focus", id: asked.focus }, label);
  return { ...s, selected: asked.selected ?? s.focus, pins: asked.pins ?? [], filters: { ...s.filters, ...asked.filters }, notice: asked.notice ?? "" };
}
