// The page address (decision 128): pure, no DOM. The format is documented in
// docs/specs/reading-and-sharing.md and must stay stable, so shared links keep working.
import { initialState, MAX_PINS, TYPES, type Id, type NodeType, type State, type View } from "./model";

export const START = "person:abraham_58";
const DEFAULT = initialState(START);

export type Asked = Partial<Omit<State, "filters">> & { filters?: Partial<State["filters"]>; view?: View };

// Defaults are left out, so Abraham with default settings is "". IDs keep their colons and commas.
// A shared link (`share`) always names the Focus, as the bare address restores the reader's own
// session (decisions 133 and 134).
export function write(s: State, view: View, share = false): string {
  const params: [string, string | number][] = [];
  if (share || s.focus !== START) params.push(["focus", s.focus]);
  if (s.selected !== s.focus) params.push(["sel", s.selected]);
  if (s.pins.length) params.push(["pins", s.pins.join(",")]);
  if (view !== "A") params.push(["view", view]);
  if (s.filters.minVotes !== DEFAULT.filters.minVotes) params.push(["votes", s.filters.minVotes]);
  if (s.filters.hidden.length) params.push(["hide", TYPES.filter((t) => s.filters.hidden.includes(t)).join(",")]);
  if (s.filters.books !== "all") params.push(["books", s.filters.books === "build" ? "build" : s.filters.books.join(",")]);
  if (!params.length) return "";
  return "?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%3A/g, ":").replace(/%2C/g, ",")}`).join("&");
}

// exists(id) says whether a node exists in this build (for a Verse, it may read the chapter); books
// are the OSIS codes of its books. Anything not recognised is left out and named in the notice; a
// missing Focus is the caller's to fill (Abraham).
export async function read(search: string, exists: (id: Id) => Promise<boolean>, books: string[]): Promise<Asked> {
  const p = new URLSearchParams(search);
  const ids = [p.get("focus"), p.get("sel"), ...(p.get("pins")?.split(",") ?? [])].filter((v) => v !== null);
  const found = new Set(await Promise.all(ids.map(async (id) => ((await exists(id)) ? id : ""))));
  const known = (id: Id) => found.has(id);
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
  // A comma-separated list keeps the values it recognises.
  const list = (key: string, ok: (v: string) => boolean) => {
    const vs = p.get(key)?.split(",") ?? [];
    const bad = vs.filter((v) => !ok(v));
    if (bad.length) dropped.push(`${key} ${bad.join(",")}`);
    return vs.filter(ok);
  };
  const filters: Asked["filters"] = {};
  const votes = take("votes", (v) => /^\d+$/.test(v));
  if (votes) filters.minVotes = +votes;
  const hidden = list("hide", (v) => TYPES.some((t) => t === v)) as NodeType[];
  if (hidden.length) filters.hidden = hidden;
  const chosen = p.get("books") === "build" ? "build" : list("books", (v) => books.includes(v));
  if (chosen.length) filters.books = chosen;
  if (Object.keys(filters).length) asked.filters = filters;
  if (dropped.length) asked.notice = `Not recognised in this link, so left out: ${dropped.join(", ")}.`;
  return asked;
}
