// The page address (decision 128): pure, no DOM. The format is documented in
// docs/specs/reading-and-sharing.md and must stay stable, so shared links keep working.
import { initialState, MAX_PINS, TYPES, typeOf, type Id, type NodeType, type State, type View } from "./model";

export const START = "person:abraham_58";
const DEFAULT = initialState(START);

export type Asked = Partial<Omit<State, "filters">> & { filters?: Partial<State["filters"]>; view?: View };

// Defaults are left out, so Abraham with default settings is "". IDs keep their colons and commas;
// a Verse is written as osis(id) gives it, "Gen.22.2" (decision 149). A shared link (`share`) always
// names the Focus, as the bare address restores the reader's own session (decisions 133 and 134).
export function write(s: State, view: View, osis: (id: Id) => string, share = false): string {
  const name = (id: Id) => (typeOf(id) === "verse" ? osis(id) : id);
  const params: [string, string | number][] = [];
  if (share || s.focus !== START) params.push(["focus", name(s.focus)]);
  if (s.selected !== s.focus) params.push(["sel", name(s.selected)]);
  if (s.pins.length) params.push(["pins", s.pins.map(name).join(",")]);
  if (view !== "A") params.push(["view", view]);
  if (s.filters.minVotes !== DEFAULT.filters.minVotes) params.push(["votes", s.filters.minVotes]);
  if (s.filters.hidden.length) params.push(["hide", TYPES.filter((t) => s.filters.hidden.includes(t)).join(",")]);
  if (s.filters.books !== "all") params.push(["books", s.filters.books === "build" ? "build" : s.filters.books.join(",")]);
  if (!params.length) return "";
  return "?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%3A/g, ":").replace(/%2C/g, ",")}`).join("&");
}

// exists(id) says whether a node exists in this build (for a Verse, it may read the chapter); books
// are the OSIS codes of its books; verseKey(text) is the Verse Key a verse reference names (the
// search box's parsing). Anything not recognised is left out and named in the notice; a missing
// Focus is the caller's to fill (Abraham).
export async function read(
  search: string,
  exists: (id: Id) => Promise<boolean>,
  books: string[],
  verseKey: (text: string) => Id | undefined,
): Promise<Asked> {
  const p = new URLSearchParams(search);
  // A Verse is written Gen.22.2 (decision 149); its Verse Key and the search box's forms read too.
  const id = (v: string) => verseKey(v) ?? v;
  const ids = [p.get("focus"), p.get("sel"), ...(p.get("pins")?.split(",") ?? [])].filter((v) => v !== null).map(id);
  const found = new Set(await Promise.all(ids.map(async (id) => ((await exists(id)) ? id : ""))));
  const known = (v: string) => found.has(id(v));
  const asked: Asked = {};
  const dropped: string[] = [];
  // A node that is neither an ID nor a Verse in any form (a mistyped Verse Key) gets its own notice.
  const unread: string[] = [];
  const readable = (v: string) => /^[a-z]+:|^\d{8}$/.test(v) || verseKey(v) !== undefined;
  const take = (key: string, ok: (v: string) => boolean, node = false) => {
    const v = p.get(key);
    if (v === null) return undefined;
    if (ok(v)) return v;
    if (node && !readable(v)) unread.push(v);
    else dropped.push(`${key} ${v}`);
  };
  const focus = take("focus", known, true);
  if (focus) asked.focus = id(focus);
  // An Overflow Node can be selected, so it can be shared.
  const selected = take("sel", (v) => known(v) || TYPES.some((t) => v === `overflow:${t}`), true);
  if (selected) asked.selected = id(selected);
  const pins = p.get("pins")?.split(",") ?? [];
  if (pins.length) {
    // A node pinned twice, in any form, counts once.
    const good = pins.filter((v, i) => known(v) && pins.findIndex((w) => id(w) === id(v)) === i);
    asked.pins = good.slice(0, MAX_PINS).map(id);
    const bad = [...pins.filter((v) => !known(v) && readable(v)), ...good.slice(MAX_PINS)];
    if (bad.length) dropped.push(`pins ${bad.join(",")}`);
    unread.push(...pins.filter((v) => !readable(v)));
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
  const notice = [
    dropped.length ? `Not recognised in this link, so left out: ${dropped.join(", ")}.` : "",
    unread.length ? `${unread.join(", ")} ${unread.length > 1 ? "are not Verses" : "is not a Verse"} here. Write a Verse as Gen.22.2 or Gen 22:2.` : "",
  ].filter(Boolean);
  if (notice.length) asked.notice = notice.join(" ");
  return asked;
}
