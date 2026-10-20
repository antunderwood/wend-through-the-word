// The page address (decision 128): pure, no DOM. The format is documented in
// docs/specs/reading-and-sharing.md and must stay stable, so shared links keep working.
import { initialState, MAX_PINS, TYPES, type Id, type State, type View } from "./model";

export const START = "person:abraham_58";
const DEFAULT = initialState(START);

export type Asked = Partial<Omit<State, "filters">> & { filters?: Partial<State["filters"]>; view?: View };

// Defaults are left out, so Abraham with default settings is "". IDs keep their colons and commas.
export function write(s: State, view: View): string {
  const params: [string, string | number][] = [];
  if (s.focus !== START) params.push(["focus", s.focus]);
  if (s.selected !== s.focus) params.push(["sel", s.selected]);
  if (s.pins.length) params.push(["pins", s.pins.join(",")]);
  if (view !== "A") params.push(["view", view]);
  if (s.filters.minVotes !== DEFAULT.filters.minVotes) params.push(["votes", s.filters.minVotes]);
  if (!params.length) return "";
  return "?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%3A/g, ":").replace(/%2C/g, ",")}`).join("&");
}

// known(id) says whether a node exists in this build. Anything not recognised is left out and
// named in the notice; a missing Focus is the caller's to fill (Abraham).
export function read(search: string, known: (id: Id) => boolean): Asked {
  const p = new URLSearchParams(search);
  const asked: Asked = {};
  const dropped: string[] = [];
  const take = (key: string, ok: (v: string) => boolean) => {
    const v = p.get(key);
    if (v === null) return undefined;
    if (ok(v)) return v;
    dropped.push(`${key} ${v}`);
  };
  const focus = take("focus", known);
  if (focus) asked.focus = focus;
  // An Overflow Node can be selected, so it can be shared.
  const selected = take("sel", (v) => known(v) || TYPES.some((t) => v === `overflow:${t}`));
  if (selected) asked.selected = selected;
  const pins = p.get("pins")?.split(",") ?? [];
  if (pins.length) {
    const good = [...new Set(pins.filter(known))];
    asked.pins = good.slice(0, MAX_PINS);
    const bad = [...pins.filter((id) => !known(id)), ...good.slice(MAX_PINS)];
    if (bad.length) dropped.push(`pins ${bad.join(",")}`);
  }
  const view = take("view", (v) => ["A", "B", "C"].includes(v));
  if (view) asked.view = view as View;
  const votes = take("votes", (v) => /^\d+$/.test(v));
  if (votes) asked.filters = { minVotes: +votes };
  if (dropped.length) asked.notice = `Not recognised in this link, so left out: ${dropped.join(", ")}.`;
  return asked;
}
