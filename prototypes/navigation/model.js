// PROTOTYPE, throwaway. Shared by all three variants of prototypes/navigation/index.html.
// Pure FocusModel (reduce, scene, relation), ported from branch prototype/focus-model and adapted to
// the Genesis export and decisions 24, 25, 31 to 33, 94. Plus data loading. No DOM, no three.js,
// so node can import it and run the rules against out/data.

export const TYPES = ["person", "place", "event", "group", "theme", "verse"];
export const TYPE_NAME = { person: "Person", place: "Place", event: "Event", group: "People Group", theme: "Theme", verse: "Verse" };
export const TYPE_PLURAL = { person: "people", place: "places", event: "events", group: "people groups", theme: "themes", verse: "verses" };
export const ROLE_NAME = { focus: "Focus", ring1: "Ring 1", ring2: "Ring 2", overflow: "Overflow Node", path: "Your Path", pinned: "Pinned Node", pinring: "around a Pinned Node" };

// Verse IDs are bare 8-digit Verse Keys; entity IDs are "type:slug"; Overflow Nodes are "overflow:type".
export const typeOf = id => (/^\d{8}$/.test(id) ? "verse" : id.slice(0, id.indexOf(":")));

export const FocusModel = (() => {
  const SCENE_PATH = 5, PIN_K = 3, RING2_K = 3, MAX_PINS = 3;
  const isCrossRef = l => l.edges.some(e => e.edge === "CROSS_REF");
  const passes = (l, f) => !isCrossRef(l) || l.weight >= f.minVotes;
  // A Ring 2 entry is a Cross-reference when both ends are Verses; its weight is then Votes.
  const passesRing2 = (parent, c, f) => !(typeOf(parent) === "verse" && typeOf(c.id) === "verse") || c.weight >= f.minVotes;

  // The words on an edge, read from the node that owns the link list towards the Neighbour.
  // direction "out": the owner is the source (owner PARENT_OF neighbour, so the neighbour is the child).
  // role on PARENT_OF is the parent's word (father or mother).
  function relation(link, genderOf) {
    const sex = genderOf(link.id);
    const kin = (m, f, x) => (sex === "Male" ? m : sex === "Female" ? f : x);
    const has = e => link.edges.some(x => x.edge === e);
    const words = [];
    const edges = [...link.edges].sort((a, b) => (b.edge === "SPOUSE_OF") - (a.edge === "SPOUSE_OF"));
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
    const co = link.edges.find(e => e.edge === "CO_MENTION");
    if (co) return { text: `together in ${co.shared_verses} verse${co.shared_verses === 1 ? "" : "s"}`, derived: true };
    if (isCrossRef(link)) return { text: `cross-reference, ${link.weight} votes`, derived: false };
    if (has("MENTIONS")) return { text: link.type === "verse" ? "named in this verse" : "named", derived: false };
    if (has("FILED_UNDER")) return { text: link.type === "verse" ? "filed here" : "filed under", derived: false };
    return { text: link.edges.map(e => e.edge).join(", "), derived: false };
  }

  const initialState = focus => ({
    focus, selected: focus, path: [], pins: [],
    filters: { k: 6, minVotes: 1, nodeLimit: 500 },
    notice: "Start.",
  });

  function reduce(s, a, label) {
    switch (a.type) {
      case "focus": {
        if (a.id === s.focus) return { ...s, selected: a.id, notice: `${label(a.id)} is already the Focus.` };
        // Your Path: every Focus of the session, each once, latest visit last.
        const path = [...s.path.filter(x => x !== a.id && x !== s.focus), s.focus];
        const back = s.path.includes(a.id) ? ` ${label(a.id)} moved off Your Path (each node once).` : "";
        return { ...s, focus: a.id, selected: a.id, path, notice: `${label(a.id)} is the Focus. ${label(s.focus)} joined Your Path.${back}` };
      }
      case "select":
        return { ...s, selected: a.id, notice: `Selected ${label(a.id)}. The scene did not change.` };
      case "step": {
        const seq = [...s.path, s.focus], i = seq.indexOf(s.selected), j = i + a.dir;
        if (i < 0) return { ...s, notice: `${label(s.selected)} is not on Your Path, so there is no previous or next.` };
        if (j < 0 || j >= seq.length) return { ...s, notice: `No ${a.dir < 0 ? "earlier" : "later"} node on Your Path.` };
        return { ...s, selected: seq[j], notice: `Selected ${label(seq[j])} on Your Path. The scene did not change.` };
      }
      case "pin":
        if (typeOf(a.id) === "overflow") return { ...s, notice: "An Overflow Node cannot be pinned." };
        if (s.pins.includes(a.id)) return { ...s, notice: `${label(a.id)} is already pinned.` };
        if (s.pins.length >= MAX_PINS) return { ...s, notice: `Refused: ${MAX_PINS} nodes are already pinned. Unpin one first.` };
        return { ...s, pins: [...s.pins, a.id], notice: `Pinned ${label(a.id)}.` };
      case "unpin":
        return { ...s, pins: s.pins.filter(x => x !== a.id), notice: `Unpinned ${label(a.id)}.` };
      case "setFilter":
        return { ...s, filters: { ...s.filters, [a.key]: a.value }, notice: `Set ${a.key} to ${a.value}.` };
      case "notice":
        return { ...s, notice: a.text };
      default:
        return s;
    }
  }

  // rec(id) returns a loaded record { id, type, links, ring2 } or undefined. The Focus and every pin must be loaded.
  function scene(s, rec, genderOf) {
    const f = s.filters, F = rec(s.focus);
    const roles = new Map();
    const tag = (id, r) => { if (!roles.has(id)) roles.set(id, new Set()); roles.get(id).add(r); };
    tag(s.focus, "focus");
    s.pins.forEach(id => tag(id, "pinned"));
    const pathShown = s.path.slice(-SCENE_PATH);   // oldest first
    pathShown.forEach(id => tag(id, "path"));

    let hiddenVotes = 0, crossRefs = 0;
    const ring1 = {}, overflow = {}, ring1Meta = new Map();
    TYPES.forEach((t, ti) => {
      // Ring 1: top K of each type by weight alone (decision 94). Links are pre-sorted by weight, then ID.
      const all = F.links.filter(l => l.type === t && l.id !== s.focus);
      const ok = all.filter(l => passes(l, f));
      hiddenVotes += all.length - ok.length;
      ring1[t] = ok.slice(0, f.k);
      overflow[t] = ok.slice(f.k);
      const m = ring1[t].length + (overflow[t].length ? 1 : 0);
      ring1[t].forEach((l, pos) => { tag(l.id, "ring1"); ring1Meta.set(l.id, { ti, pos, m }); if (isCrossRef(l)) crossRefs++; });
      if (overflow[t].length) ring1Meta.set(`overflow:${t}`, { ti, pos: m - 1, m });
    });

    // Each pin brings its own top 3 of each type, no Ring 2 (decision 25).
    const pinRing = {};
    s.pins.forEach((p, pinIndex) => {
      if (p === s.focus) return;
      const P = rec(p);
      pinRing[p] = TYPES.flatMap((t, ti) => P.links.filter(l => l.type === t && l.id !== p && passes(l, f))
        .slice(0, PIN_K).map((l, rank) => ({ id: l.id, pin: p, rank, ti, pos: pinIndex })));
      pinRing[p].forEach(n => tag(n.id, "pinring"));
    });

    // Ring 2: up to 3 of each Ring 1 node's stored top 10 that pass the filters and are not already on screen.
    let ring2 = [];
    TYPES.forEach((t, ti) => ring1[t].forEach((r, pos) => {
      let rank = 0;
      for (const c of F.ring2[r.id] || []) {
        if (rank === RING2_K) break;
        if (!passesRing2(r.id, c, f)) { hiddenVotes++; continue; }
        if (roles.has(c.id)) continue;
        tag(c.id, "ring2");
        ring2.push({ id: c.id, via: r.id, weight: c.weight, rank, pos, ti });
        if (typeOf(r.id) === "verse" && typeOf(c.id) === "verse") crossRefs++;
        rank++;
      }
    }));

    // Node limit (decision 33): Ring 2, then the oldest Your Path nodes, then pin rings. Round robin within groups.
    const overflowCount = TYPES.filter(t => overflow[t].length).length;
    const trimmed = { ring2: 0, path: 0, pinring: 0 };
    const count = () => roles.size + overflowCount;
    const demand = count();
    const drop = (id, role) => {
      const rs = roles.get(id);
      if (!rs || !rs.has(role)) return;
      rs.delete(role);
      if (!rs.size) { roles.delete(id); trimmed[role]++; }
    };
    const roundRobin = (a, b) => (b.rank - a.rank) || (b.pos - a.pos) || (b.ti - a.ti);
    const q2 = [...ring2].sort(roundRobin);
    while (count() > f.nodeLimit && q2.length) drop(q2.shift().id, "ring2");
    ring2 = ring2.filter(r => roles.get(r.id)?.has("ring2"));
    const pq = [...pathShown];
    while (count() > f.nodeLimit && pq.length) drop(pq.shift(), "path");
    const pathKept = pathShown.filter(id => roles.get(id)?.has("path"));
    const pinQ = Object.values(pinRing).flat().sort(roundRobin);
    while (count() > f.nodeLimit && pinQ.length) drop(pinQ.shift().id, "pinring");
    for (const p in pinRing) pinRing[p] = pinRing[p].filter(n => roles.get(n.id)?.has("pinring"));

    // Shared Node: in Ring 1 or around a pin, linked to both the Focus and a pin. Any link counts (finding 4).
    const near = R => new Set(R.links.filter(l => passes(l, f)).map(l => l.id));
    const focusNear = near(F);
    const pinNear = s.pins.filter(p => p !== s.focus).map(p => near(rec(p)));
    const shared = new Set();
    for (const [id, rs] of roles) {
      if ((rs.has("ring1") || rs.has("pinring")) && !rs.has("pinned") && id !== s.focus
        && focusNear.has(id) && pinNear.some(ps => ps.has(id))) shared.add(id);
    }

    // Nodes, one per ID, placed by their most important role.
    const PRIORITY = ["focus", "pinned", "ring1", "pinring", "path", "ring2"];
    const ring2By = new Map(ring2.map(r => [r.id, r]));
    const pinRingBy = new Map();
    for (const p in pinRing) for (const n of pinRing[p]) if (!pinRingBy.has(n.id)) pinRingBy.set(n.id, n);
    const nodes = [];
    for (const [id, rs] of roles) {
      const role = PRIORITY.find(r => rs.has(r));
      const n = { id, type: typeOf(id), role, roles: PRIORITY.filter(r => rs.has(r)), shared: shared.has(id) };
      if (rs.has("ring1")) n.ring1 = ring1Meta.get(id);
      if (role === "pinned") n.pinIndex = s.pins.indexOf(id);
      if (role === "path") n.pathIndex = pathKept.length - 1 - pathKept.indexOf(id);   // 0 is the newest
      if (role === "pinring") { const pr = pinRingBy.get(id); Object.assign(n, { pin: pr.pin, ti: pr.ti, rank: pr.rank }); }
      if (role === "ring2") { const r2 = ring2By.get(id); Object.assign(n, { via: r2.via, rank: r2.rank }); }
      nodes.push(n);
    }
    for (const t of TYPES) if (overflow[t].length) {
      nodes.push({ id: `overflow:${t}`, type: t, role: "overflow", roles: ["overflow"], shared: false, count: overflow[t].length, ring1: ring1Meta.get(`overflow:${t}`) });
    }

    const edges = [];
    for (const t of TYPES) for (const l of ring1[t]) {
      const r = relation(l, genderOf);
      edges.push({ a: s.focus, b: l.id, kind: "focus", label: r.text, dashed: r.derived });
    }
    for (const t of TYPES) if (overflow[t].length) edges.push({ a: s.focus, b: `overflow:${t}`, kind: "overflow" });
    for (const r of ring2) edges.push({ a: r.via, b: r.id, kind: "ring2" });
    for (const p in pinRing) for (const n of pinRing[p]) edges.push({ a: p, b: n.id, kind: "pin" });
    const chain = [s.focus, ...[...pathKept].reverse()];
    for (let i = 1; i < chain.length; i++) edges.push({ a: chain[i - 1], b: chain[i], kind: "path" });

    return {
      focus: s.focus, nodes, edges, ring1, overflow, shared,
      count: count(), demand, hidden: demand - count(), trimmed, limit: f.nodeLimit,
      hiddenVotes, crossRefs,
    };
  }

  return { SCENE_PATH, MAX_PINS, initialState, reduce, scene, relation, passes };
})();

// ---- Data loading. getJSON(url) is injected (fetch in the browser, fs in node). ----
export function createData(getJSON, root) {
  const D = { base: "", names: new Map(), books: new Map(), records: new Map() };
  const pending = new Map();

  D.init = async () => {
    const idx = await getJSON(`${root}/index.json`);
    D.version = idx.data_version;
    D.base = `${root}/${idx.data_version}`;
    const si = await getJSON(`${D.base}/search-index.json`);
    for (const b of si.books) D.books.set(b.number, b);
    for (const e of si.entities) D.names.set(e.id, e.name);
  };

  D.verseParts = key => {
    const b = D.books.get(key.slice(0, 2)), chapter = +key.slice(2, 5);
    return { osis: b ? b.osis : "?", chapter, verse: +key.slice(5), inBuild: !!b && b.chapters.includes(chapter) };
  };

  D.label = id => {
    const t = typeOf(id);
    if (t === "verse") { const v = D.verseParts(id); return `${v.osis} ${v.chapter}:${v.verse}`; }
    const name = D.names.get(id) ?? D.records.get(id)?.raw?.name ?? id;
    // Nave's headings are upper case ("FAITH"); show them as "Faith".
    return t === "theme" && name === name.toUpperCase() ? name.toLowerCase().replace(/(^|[\s(,])\S/g, c => c.toUpperCase()) : name;
  };

  const sortLinks = links => links.sort((a, b) => (b.weight - a.weight) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  D.paths = id => {
    const t = typeOf(id);
    if (t === "verse") {
      const v = D.verseParts(id);
      return v.inBuild ? [`${D.base}/chapter/${v.osis}/${v.chapter}.json`, `${D.base}/chapter/${v.osis}/${v.chapter}.ring2.json`] : [];
    }
    return [`${D.base}/entity/${t}/${id.slice(t.length + 1)}.json`];
  };

  async function fetchRecord(id) {
    const t = typeOf(id);
    if (t === "verse") {
      const v = D.verseParts(id);
      if (!v.inBuild) return { id, type: t, links: [], ring2: {}, outside: true };
      const [chFile, sideFile] = D.paths(id);
      const [ch, side] = await Promise.all([getJSON(chFile), getJSON(sideFile)]);
      const row = ch.verses.find(x => x.key === id);
      if (!row) return { id, type: t, links: [], ring2: {}, error: `Verse ${id} not in ${chFile}` };
      // Verse Focus: Ring 1 from the chapter file. Mentions and Filed Under carry no weight, so they keep ID order.
      const links = [
        ...(row.mentions || []).map(m => ({ id: m.id, type: typeOf(m.id), weight: 0, edges: [{ edge: "MENTIONS", direction: "out" }] })),
        ...(row.filed_under || []).map(m => ({ id: m.id, type: "theme", weight: 0, edges: [{ edge: "FILED_UNDER", direction: "out" }] })),
        ...(row.cross_references || []).map(c => ({ id: c.id, type: "verse", weight: c.weight, edges: c.edges })),
      ];
      return { id, type: t, links: sortLinks(links), ring2: side.ring2 || {}, raw: row };
    }
    const [file] = D.paths(id);
    const d = await getJSON(file);
    const links = [
      ...d.neighbours.map(n => ({ id: n.id, type: n.type, weight: n.weight, edges: n.edges })),
      // Entity to Verse: weight is the number of other Entities in the Verse (PRD 10.4 rule 2).
      ...(d.verses || []).map(v => ({ id: v.key, type: "verse", weight: v.weight, edges: [{ edge: v.edge, direction: v.direction }] })),
    ];
    return { id, type: t, links: sortLinks(links), ring2: d.ring2 || {}, gender: d.gender, raw: d };
  }

  D.load = id => {
    if (D.records.has(id)) return Promise.resolve(D.records.get(id));
    if (!pending.has(id)) {
      pending.set(id, fetchRecord(id)
        .catch(err => ({ id, type: typeOf(id), links: [], ring2: {}, error: String(err.message || err) }))
        .then(r => { D.records.set(id, r); return r; }));
    }
    return pending.get(id);
  };
  D.rec = id => D.records.get(id);
  D.genderOf = id => D.records.get(id)?.gender;
  return D;
}
