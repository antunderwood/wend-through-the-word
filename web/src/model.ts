// The Focus Model: pure, no DOM, no three.js. It owns every disclosure rule (decisions 24, 25, 31
// to 33, 94, 119). Lifted from model.js on the prototype/navigation branch.

export const TYPES = ["person", "place", "event", "group", "theme", "verse"] as const;
export type NodeType = (typeof TYPES)[number];
export const TYPE_PLURAL: Record<NodeType, string> = {
  person: "people",
  place: "places",
  event: "events",
  group: "people groups",
  theme: "themes",
  verse: "verses",
};

// Entity IDs are "type:slug", Verse IDs are bare 8 digit Verse Keys, Overflow Nodes are "overflow:type".
export type Id = string;
export const typeOf = (id: Id): NodeType | "overflow" =>
  /^\d{8}$/.test(id) ? "verse" : (id.slice(0, id.indexOf(":")) as NodeType | "overflow");

// direction "out": the link owner is the source (owner PARENT_OF neighbour, so the neighbour is the
// child). role on PARENT_OF is the parent's word (father or mother).
export type Edge = { edge: string; direction: "out" | "in" | "both"; role?: string; shared_verses?: number };
export type Link = { id: Id; type: NodeType; weight: number; edges: Edge[] };
// A loaded node: links sorted by weight, then ID; ring2 maps a Ring 1 ID to its stored top 10.
export type Rec = { id: Id; type: NodeType; links: Link[]; ring2: Record<Id, { id: Id; weight: number }[]>; gender?: string };

export type View = "A" | "B" | "C";
export type State = {
  focus: Id;
  selected: Id;
  path: Id[]; // every earlier Focus, each once, latest visit last
  pins: Id[]; // at most 3
  cleared: Id[] | null; // what the last clearPath removed, for undoClear
  filters: { k: number; minVotes: number; nodeLimit: number };
  notice: string;
};
export type Action =
  | { type: "focus" | "select" | "pin" | "unpin"; id: Id }
  | { type: "step"; dir: -1 | 1 } // Prev and Next along [...path, focus]
  | { type: "setFilter"; key: keyof State["filters"]; value: number }
  | { type: "clearPath" }
  | { type: "undoClear" };
export type Role = "focus" | "pinned" | "ring1" | "pinring" | "path" | "ring2" | "overflow";
export type SceneNode = {
  id: Id;
  type: NodeType;
  role: Role;
  roles: Role[];
  shared: boolean;
  ring1?: { ti: number; pos: number; m: number }; // sector index, place in sector, sector size
  pinIndex?: number;
  pathIndex?: number; // 0 is the newest
  pin?: Id; // the Pinned Node a pin ring node surrounds
  ti?: number;
  via?: Id; // the Ring 1 parent of a Ring 2 node
  rank?: number;
  count?: number; // Neighbours behind an Overflow Node
};
export type SceneEdge = { a: Id; b: Id; kind: "focus" | "overflow" | "ring2" | "pin" | "path"; label?: string; dashed?: boolean };
export type Scene = {
  nodes: SceneNode[];
  edges: SceneEdge[];
  count: number;
  demand: number;
  hidden: number;
  trimmed: { ring2: number; path: number; pinring: number };
  hiddenVotes: number;
};

const SCENE_PATH = 5,
  PIN_K = 3,
  RING2_K = 3,
  MAX_PINS = 3;
const isCrossRef = (l: Link) => l.edges.some((e) => e.edge === "CROSS_REF");
const passes = (l: Link, f: State["filters"]) => !isCrossRef(l) || l.weight >= f.minVotes;
// A Ring 2 entry is a Cross-reference when both ends are Verses; its weight is then Votes.
const passesRing2 = (parent: Id, c: { id: Id; weight: number }, f: State["filters"]) =>
  !(typeOf(parent) === "verse" && typeOf(c.id) === "verse") || c.weight >= f.minVotes;

// The words on an edge, read from the node that owns the link list towards the Neighbour.
export function relation(link: Link, genderOf: (id: Id) => string | undefined) {
  const sex = genderOf(link.id);
  const kin = (m: string, f: string, x: string) => (sex === "Male" ? m : sex === "Female" ? f : x);
  const has = (e: string) => link.edges.some((x) => x.edge === e);
  const words: string[] = [];
  const edges = [...link.edges].sort((a, b) => +(b.edge === "SPOUSE_OF") - +(a.edge === "SPOUSE_OF"));
  for (const e of edges) {
    const out = e.direction === "out";
    switch (e.edge) {
      case "PARENT_OF": words.push(out ? kin("son", "daughter", "child") : e.role || kin("father", "mother", "parent")); break;
      case "SPOUSE_OF": words.push(kin("husband", "wife", "spouse")); break;
      case "CONCUBINE_OF": if (!out) words.push("concubine"); else if (!has("SPOUSE_OF")) words.push("partner"); break;
      case "PARTNER_OF": words.push("partner"); break;
      case "POSSIBLY_SAME_AS": words.push("possibly the same person"); break;
      case "SIBLING_OF": words.push(kin("brother", "sister", "sibling")); break;
      case "HALF_SIBLING_OF": words.push(kin("half-brother", "half-sister", "half-sibling")); break;
      case "BORN_AT": words.push(out ? "birthplace" : "born here"); break;
      case "DIED_AT": words.push(out ? "place of death" : "died here"); break;
      case "PARTICIPATED_IN": words.push("took part"); break;
      case "OCCURRED_AT": words.push(out ? "where it happened" : "happened here"); break;
      case "MEMBER_OF": words.push(out ? "member of" : "member"); break;
    }
  }
  const explicit = [...new Set(words)];
  if (explicit.length) return { text: explicit.join(", "), derived: false };
  const co = link.edges.find((e) => e.edge === "CO_MENTION");
  if (co) return { text: `together in ${co.shared_verses} verse${co.shared_verses === 1 ? "" : "s"}`, derived: true };
  if (isCrossRef(link)) return { text: `cross-reference, ${link.weight} votes`, derived: false };
  if (has("MENTIONS")) return { text: link.type === "verse" ? "named in this verse" : "named", derived: false };
  if (has("FILED_UNDER")) return { text: link.type === "verse" ? "filed here" : "filed under", derived: false };
  return { text: link.edges.map((e) => e.edge).join(", "), derived: false };
}

export const initialState = (focus: Id): State => ({
  focus,
  selected: focus,
  path: [],
  pins: [],
  cleared: null,
  filters: { k: 6, minVotes: 1, nodeLimit: 500 },
  notice: "",
});

// label names a node in the notice line.
export function reduce(s: State, a: Action, label: (id: Id) => string): State {
  switch (a.type) {
    case "focus": {
      if (a.id === s.focus) return { ...s, selected: a.id, notice: `${label(a.id)} is already the Focus.` };
      // Your Path: every Focus of the session, each once, latest visit last.
      const path = [...s.path.filter((x) => x !== a.id && x !== s.focus), s.focus];
      return { ...s, focus: a.id, selected: a.id, path, notice: `${label(a.id)} is the Focus.` };
    }
    case "select":
      return { ...s, selected: a.id, notice: "" };
    case "step": {
      const seq = [...s.path, s.focus],
        i = seq.indexOf(s.selected),
        j = i + a.dir;
      if (i < 0) return { ...s, notice: `${label(s.selected)} is not on Your Path.` };
      if (j < 0 || j >= seq.length) return { ...s, notice: `No ${a.dir < 0 ? "earlier" : "later"} node on Your Path.` };
      return { ...s, selected: seq[j], notice: "" };
    }
    case "pin":
      if (typeOf(a.id) === "overflow") return { ...s, notice: "An Overflow Node cannot be pinned." };
      if (s.pins.includes(a.id)) return { ...s, notice: `${label(a.id)} is already pinned.` };
      if (s.pins.length >= MAX_PINS) return { ...s, notice: `${MAX_PINS} nodes are already pinned. Unpin one first.` };
      return { ...s, pins: [...s.pins, a.id], notice: `Pinned ${label(a.id)}.` };
    case "unpin":
      return { ...s, pins: s.pins.filter((x) => x !== a.id), notice: `Unpinned ${label(a.id)}.` };
    case "setFilter":
      return { ...s, filters: { ...s.filters, [a.key]: a.value } };
    case "clearPath": {
      if (!s.path.length) return s;
      // The Focus and pins stay; a Selected Node only on Your Path gives way to the Focus.
      const selected = s.path.includes(s.selected) ? s.focus : s.selected;
      return { ...s, path: [], cleared: s.path, selected, notice: "Cleared Your Path." };
    }
    case "undoClear": {
      if (!s.cleared) return s;
      // The cleared nodes go back before any visited since, each once; the Focus stays off Your Path.
      const path = [...s.cleared.filter((x) => x !== s.focus && !s.path.includes(x)), ...s.path];
      return { ...s, path, cleared: null, notice: "Restored Your Path." };
    }
  }
}

// rec(id) gives a loaded record; the Focus and every pin must be loaded.
export function scene(s: State, rec: (id: Id) => Rec | undefined, genderOf: (id: Id) => string | undefined): Scene {
  const f = s.filters,
    F = rec(s.focus)!;
  const roles = new Map<Id, Set<Role>>();
  const tag = (id: Id, r: Role) => {
    if (!roles.has(id)) roles.set(id, new Set());
    roles.get(id)!.add(r);
  };
  tag(s.focus, "focus");
  s.pins.forEach((id) => tag(id, "pinned"));
  const pathShown = s.path.slice(-SCENE_PATH); // oldest first
  pathShown.forEach((id) => tag(id, "path"));

  // The top K of each type, after filters, by weight then ID (decision 94). Links are pre-sorted.
  const topK = (R: Rec, t: NodeType, k: number) => R.links.filter((l) => l.type === t && l.id !== R.id && passes(l, f)).slice(0, k);

  let hiddenVotes = 0;
  const ring1 = {} as Record<NodeType, Link[]>,
    overflow = {} as Record<NodeType, Link[]>,
    ring1Meta = new Map<Id, SceneNode["ring1"]>();
  TYPES.forEach((t, ti) => {
    const all = F.links.filter((l) => l.type === t && l.id !== s.focus);
    const ok = all.filter((l) => passes(l, f));
    hiddenVotes += all.length - ok.length;
    ring1[t] = ok.slice(0, f.k);
    overflow[t] = ok.slice(f.k);
    // The Overflow Node sits last in its sector.
    const m = ring1[t].length + (overflow[t].length ? 1 : 0);
    ring1[t].forEach((l, pos) => {
      tag(l.id, "ring1");
      ring1Meta.set(l.id, { ti, pos, m });
    });
    if (overflow[t].length) ring1Meta.set(`overflow:${t}`, { ti, pos: m - 1, m });
  });

  // Each pin brings its own top 3 of each type, no Ring 2 (decision 25).
  type Around = { id: Id; pin: Id; rank: number; ti: number; pos: number };
  const pinRing: Record<Id, Around[]> = {};
  s.pins.forEach((p, pinIndex) => {
    if (p === s.focus) return;
    pinRing[p] = TYPES.flatMap((t, ti) => topK(rec(p)!, t, PIN_K).map((l, rank) => ({ id: l.id, pin: p, rank, ti, pos: pinIndex })));
    pinRing[p].forEach((n) => tag(n.id, "pinring"));
  });

  // Ring 2: up to 3 of each Ring 1 node's stored top 10 that pass the filters and are not already on screen.
  type Outer = { id: Id; via: Id; rank: number; pos: number; ti: number };
  let ring2: Outer[] = [];
  TYPES.forEach((t, ti) =>
    ring1[t].forEach((r, pos) => {
      let rank = 0;
      for (const c of F.ring2[r.id] ?? []) {
        if (rank === RING2_K) break;
        if (!passesRing2(r.id, c, f)) {
          hiddenVotes++;
          continue;
        }
        if (roles.has(c.id)) continue;
        tag(c.id, "ring2");
        ring2.push({ id: c.id, via: r.id, rank, pos, ti });
        rank++;
      }
    }),
  );

  // Node limit (decision 33): Ring 2, then the oldest Your Path nodes, then pin rings. Round robin
  // within a group: each parent loses its third before any parent loses its second.
  const overflowCount = TYPES.filter((t) => overflow[t].length).length;
  const trimmed = { ring2: 0, path: 0, pinring: 0 };
  const count = () => roles.size + overflowCount;
  const demand = count();
  const drop = (id: Id, role: "ring2" | "path" | "pinring") => {
    const rs = roles.get(id);
    if (!rs?.delete(role)) return;
    if (!rs.size) {
      roles.delete(id);
      trimmed[role]++;
    }
  };
  const roundRobin = (a: Outer | Around, b: Outer | Around) => b.rank - a.rank || b.pos - a.pos || b.ti - a.ti;
  const q2 = [...ring2].sort(roundRobin);
  while (count() > f.nodeLimit && q2.length) drop(q2.shift()!.id, "ring2");
  ring2 = ring2.filter((r) => roles.get(r.id)?.has("ring2"));
  const pq = [...pathShown];
  while (count() > f.nodeLimit && pq.length) drop(pq.shift()!, "path");
  const pathKept = pathShown.filter((id) => roles.get(id)?.has("path"));
  const pinQ = Object.values(pinRing).flat().sort(roundRobin);
  while (count() > f.nodeLimit && pinQ.length) drop(pinQ.shift()!.id, "pinring");
  for (const p in pinRing) pinRing[p] = pinRing[p].filter((n) => roles.get(n.id)?.has("pinring"));

  // Shared Node (decision 119): in Ring 1 or around a pin, and in the top K of its type for both
  // the Focus and a Pinned Node.
  const topIds = (R: Rec) => new Set(TYPES.flatMap((t) => topK(R, t, f.k).map((l) => l.id)));
  const focusTop = topIds(F);
  const pinTops = s.pins.filter((p) => p !== s.focus).map((p) => topIds(rec(p)!));
  const isShared = (id: Id, rs: Set<Role>) =>
    (rs.has("ring1") || rs.has("pinring")) && !rs.has("pinned") && focusTop.has(id) && pinTops.some((ps) => ps.has(id));

  // Nodes, one per ID, placed by their most important role.
  const PRIORITY: Role[] = ["focus", "pinned", "ring1", "pinring", "path", "ring2"];
  const ring2By = new Map(ring2.map((r) => [r.id, r]));
  const pinRingBy = new Map<Id, Around>();
  for (const p in pinRing) for (const n of pinRing[p]) if (!pinRingBy.has(n.id)) pinRingBy.set(n.id, n);
  const nodes: SceneNode[] = [];
  for (const [id, rs] of roles) {
    const role = PRIORITY.find((r) => rs.has(r))!;
    const n: SceneNode = { id, type: typeOf(id) as NodeType, role, roles: PRIORITY.filter((r) => rs.has(r)), shared: isShared(id, rs) };
    if (rs.has("ring1")) n.ring1 = ring1Meta.get(id);
    if (role === "pinned") n.pinIndex = s.pins.indexOf(id);
    if (role === "path") n.pathIndex = pathKept.length - 1 - pathKept.indexOf(id);
    if (role === "pinring") {
      const pr = pinRingBy.get(id)!;
      Object.assign(n, { pin: pr.pin, ti: pr.ti, rank: pr.rank });
    }
    if (role === "ring2") {
      const r2 = ring2By.get(id)!;
      Object.assign(n, { via: r2.via, rank: r2.rank });
    }
    nodes.push(n);
  }
  for (const t of TYPES)
    if (overflow[t].length) {
      const id = `overflow:${t}`;
      nodes.push({ id, type: t, role: "overflow", roles: ["overflow"], shared: false, count: overflow[t].length, ring1: ring1Meta.get(id) });
    }

  const edges: SceneEdge[] = [];
  for (const t of TYPES)
    for (const l of ring1[t]) {
      const r = relation(l, genderOf);
      edges.push({ a: s.focus, b: l.id, kind: "focus", label: r.text, dashed: r.derived });
    }
  for (const t of TYPES) if (overflow[t].length) edges.push({ a: s.focus, b: `overflow:${t}`, kind: "overflow" });
  for (const r of ring2) edges.push({ a: r.via, b: r.id, kind: "ring2" });
  for (const p in pinRing) for (const n of pinRing[p]) edges.push({ a: p, b: n.id, kind: "pin" });
  const chain = [s.focus, ...[...pathKept].reverse()];
  for (let i = 1; i < chain.length; i++) edges.push({ a: chain[i - 1], b: chain[i], kind: "path" });

  return { nodes, edges, count: count(), demand, hidden: demand - count(), trimmed, hiddenVotes };
}
