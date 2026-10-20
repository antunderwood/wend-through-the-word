import { beforeAll, describe, expect, it } from "vitest";
import { createData, type Data } from "../src/data";
import { afterClear, initialState, reduce, relation, scene, type Action, type Edge, type NodeType, type Scene, type State } from "../src/model";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58";
let data: Data;

beforeAll(async () => {
  data = await createData(readExport, "");
  await data.loadWithKin(ABRAHAM);
});

const draw = (s: State) => scene(s, data.rec, data.genderOf);
const ids = (sc: Scene, role: string) => sc.nodes.filter((n) => n.role === role).map((n) => n.id);
const ring1Of = (sc: Scene, type: string) =>
  sc.nodes.filter((n) => n.role === "ring1" && n.type === type).sort((a, b) => a.ring1!.pos - b.ring1!.pos).map((n) => n.id);
const limit = (n: number) => reduce(initialState(ABRAHAM), { type: "setFilter", key: "nodeLimit", value: n }, data.label);

describe("Abraham as the Focus, K = 6", () => {
  it("puts the top 6 of each type in Ring 1, by weight then ID", () => {
    const sc = draw(initialState(ABRAHAM));
    // Fixture weights (cosine; for Themes decision 111; for Verses the other Entities in them).
    expect(ring1Of(sc, "person")).toEqual([
      "person:isaac_616", // 0.5111
      "person:sarah_2473", // 0.3223
      "person:haran_1407",
      "person:nahor_2143",
      "person:hagar_1348",
      "person:terah_2841", // 0.1961; God (0.1554) is seventh
    ]);
    // Only 5 Places: Beer-lahai-roi and Canaan tie at 0.124, Gerar and Haran at 0.0555.
    expect(ring1Of(sc, "place")).toEqual([
      "place:ur_1189",
      "place:beer-lahai-roi_167",
      "place:canaan_272",
      "place:gerar_459",
      "place:haran_527",
    ]);
    // Bastard and Heir tie at 27.7392.
    expect(ring1Of(sc, "theme")).toEqual([
      "theme:god",
      "theme:genealogy",
      "theme:covenant",
      "theme:bastard",
      "theme:heir",
      "theme:blessing",
    ]);
    // Gen 11:27 and 11:29 both have 8 other Entities.
    expect(ring1Of(sc, "verse")).toEqual(["01011031", "01011027", "01011029", "01011026", "01016005", "01016003"]);
    expect(ring1Of(sc, "group")).toEqual(["group:genealogy_of_jesus"]);
  });

  it("breaks a tie at the edge of Ring 1 by ID", () => {
    // Abraham enters Canaan (event:71) and event:77 tie at 0.0877 for the sixth Event place.
    const events = ring1Of(draw(initialState(ABRAHAM)), "event");
    expect(events).toEqual(["event:65", "event:61", "event:66", "event:88", "event:76", "event:71"]);
  });

  it("adds one Overflow Node for each type with more Neighbours, with its count", () => {
    const overflow = draw(initialState(ABRAHAM)).nodes.filter((n) => n.role === "overflow");
    // Fixture: 21 People, 7 Events, 36 Themes, 26 Verses; 5 Places and 1 People Group fit.
    expect(Object.fromEntries(overflow.map((n) => [n.id, n.count]))).toEqual({
      "overflow:person": 15,
      "overflow:event": 1,
      "overflow:theme": 30,
      "overflow:verse": 20,
    });
  });

  it("fills Ring 2 from each Ring 1 node's stored top 10, skipping nodes already on screen", () => {
    const sc = draw(initialState(ABRAHAM));
    const via = (id: string) => sc.nodes.filter((n) => n.role === "ring2" && n.via === id).map((n) => n.id);
    // Isaac's stored list starts with Abraham, the Focus.
    expect(via("person:isaac_616")).toEqual(["person:israel_682", "person:rebekah_2401", "theme:wells"]);
    // Sarah's starts with Hagar (Ring 1) and Abraham.
    expect(via("person:sarah_2473")).toEqual(["person:heth_1510", "person:iscah_618", "person:milcah_2082"]);
    expect(ids(sc, "ring2")).toHaveLength(64);
    expect(sc.count).toBe(99); // 1 Focus, 30 Ring 1, 4 Overflow Nodes, 64 Ring 2
  });
});

describe("the node limit (decision 33)", () => {
  it("trims Ring 2 only, and says how many are hidden", () => {
    const sc = draw(limit(60));
    expect([sc.count, sc.demand, sc.hidden]).toEqual([60, 99, 39]);
    expect(sc.trimmed).toEqual({ ring2: 39, path: 0, pinring: 0 });
    expect(ids(sc, "ring1")).toHaveLength(30);
    expect(ids(sc, "overflow")).toHaveLength(4);
  });

  it("takes each parent's third Ring 2 node before any parent's second", () => {
    // Fixture: 27 Ring 1 nodes have Ring 2, with 27 first, 21 second, and 16 third neighbours.
    // A limit of 70 leaves room for 35 Ring 2 nodes: every first, and 8 seconds.
    const full = draw(initialState(ABRAHAM)).nodes.filter((n) => n.role === "ring2");
    const kept = draw(limit(70)).nodes.filter((n) => n.role === "ring2");
    const byRank = (k: number) => kept.filter((n) => n.rank === k);
    expect([byRank(0).length, byRank(1).length, byRank(2).length]).toEqual([27, 8, 0]);
    expect(new Set(byRank(0).map((n) => n.via))).toEqual(new Set(full.map((n) => n.via)));
  });
});

describe("select and focus", () => {
  const [ISAAC, SARAH, HAGAR, TERAH, JACOB, REBEKAH] = [
    "person:isaac_616",
    "person:sarah_2473",
    "person:hagar_1348",
    "person:terah_2841",
    "person:israel_682",
    "person:rebekah_2401",
  ];
  beforeAll(() => Promise.all([ISAAC, SARAH, HAGAR, TERAH, JACOB, REBEKAH].map(data.load)));
  const walk = (s: State, ...ids: string[]) => ids.reduce((t, id) => reduce(t, { type: "focus", id }, data.label), s);

  it("selecting a node never changes the scene", () => {
    const s = initialState(ABRAHAM);
    for (const id of [ISAAC, "place:ur_1189", "overflow:theme", "01011031"]) {
      const t = reduce(s, { type: "select", id }, data.label);
      expect(t.selected).toBe(id);
      expect(draw(t)).toEqual(draw(s));
    }
  });

  it("moves the old Focus onto Your Path, each node once at its latest visit", () => {
    const s = walk(initialState(ABRAHAM), ISAAC, SARAH, ISAAC, ABRAHAM);
    expect([s.focus, s.selected]).toEqual([ABRAHAM, ABRAHAM]);
    expect(s.path).toEqual([SARAH, ISAAC]); // latest visit last; the Focus is never on Your Path
    expect(s.notice).toBe("Abraham is the Focus.");
  });

  it("focusing the current Focus only selects it", () => {
    const s = reduce(initialState(ABRAHAM), { type: "select", id: ISAAC }, data.label);
    const t = reduce(s, { type: "focus", id: ABRAHAM }, data.label);
    expect({ ...t, notice: "" }).toEqual({ ...s, selected: ABRAHAM, notice: "" });
    expect(t.notice).toBe("Abraham is already the Focus.");
  });

  it("draws only the last 5 of Your Path, newest nearest the Focus", () => {
    const s = walk(initialState(ABRAHAM), ISAAC, SARAH, HAGAR, TERAH, JACOB, REBEKAH);
    expect(s.path).toEqual([ABRAHAM, ISAAC, SARAH, HAGAR, TERAH, JACOB]);
    const sc = draw(s);
    // Abraham, the oldest, is left out. Isaac and Jacob are also in Rebekah's Ring 1 and drawn there.
    const onPath = sc.nodes.filter((n) => n.roles.includes("path")).map((n) => n.id);
    expect(onPath.sort()).toEqual([ISAAC, SARAH, HAGAR, TERAH, JACOB].sort());
    // One path line: the Focus, then the newest to the oldest drawn.
    const line = sc.edges.filter((e) => e.kind === "path").map((e) => [e.a, e.b]);
    expect(line).toEqual([
      [REBEKAH, JACOB],
      [JACOB, TERAH],
      [TERAH, HAGAR],
      [HAGAR, SARAH],
      [SARAH, ISAAC],
    ]);
  });

  describe("Prev and Next", () => {
    let s: State; // Your Path: Abraham, Isaac; Sarah the Focus
    beforeAll(() => {
      s = walk(initialState(ABRAHAM), ISAAC, SARAH);
    });
    const step = (t: State, ...dirs: (-1 | 1)[]) => dirs.reduce((u, dir) => reduce(u, { type: "step", dir }, data.label), t);

    it("step the selection along Your Path without moving the Focus", () => {
      expect(step(s, -1).selected).toBe(ISAAC);
      expect(step(s, -1, -1).selected).toBe(ABRAHAM);
      expect(step(s, -1, -1, 1).selected).toBe(ISAAC);
      expect(step(s, -1, -1, 1, 1).selected).toBe(SARAH);
      expect(draw(step(s, -1, -1))).toEqual(draw(s));
    });

    it("give a notice and change nothing at either end", () => {
      const oldest = step(s, -1, -1);
      expect({ ...step(oldest, -1), notice: "" }).toEqual({ ...oldest, notice: "" });
      expect(step(oldest, -1).notice).toBe("No earlier node on Your Path.");
      expect({ ...step(s, 1), notice: "" }).toEqual({ ...s, notice: "" });
      expect(step(s, 1).notice).toBe("No later node on Your Path.");
    });

    it("give a notice and change nothing when the Selected Node is off Your Path", () => {
      const off = reduce(s, { type: "select", id: HAGAR }, data.label);
      for (const dir of [-1, 1] as const) {
        expect({ ...step(off, dir), notice: "" }).toEqual(off);
        expect(step(off, dir).notice).toBe("Hagar is not on Your Path.");
      }
    });
  });

  describe("Clear and Undo clear", () => {
    // As the app applies it: the reducer, then the Selected Node checked against the new scene.
    const clear = (t: State) => {
      const u = reduce(t, { type: "clearPath" }, data.label);
      return afterClear(u, draw(u));
    };
    const undo = (t: State) => reduce(t, { type: "undoClear" }, data.label);
    let s: State; // Your Path: Abraham, Isaac, Hagar; Sarah the Focus
    beforeAll(() => {
      s = walk(initialState(ABRAHAM), ISAAC, HAGAR, SARAH);
    });

    it("Clear empties Your Path and keeps the Focus and pins", () => {
      const pinned = reduce(s, { type: "pin", id: ISAAC }, data.label);
      const t = clear(pinned);
      expect([t.focus, t.path, t.pins]).toEqual([SARAH, [], [ISAAC]]);
    });

    it("a Selected Node only on Your Path gives way to the Focus; a pinned one stays", () => {
      // With Terah the Focus, Hagar is only on Your Path, and the clear leaves her out of the scene.
      const t = walk(initialState(ABRAHAM), ISAAC, HAGAR, TERAH);
      expect(clear(reduce(t, { type: "select", id: HAGAR }, data.label)).selected).toBe(TERAH);
      const pinned = reduce(reduce(s, { type: "pin", id: ISAAC }, data.label), { type: "select", id: ISAAC }, data.label);
      expect(clear(pinned).selected).toBe(ISAAC);
      // A Ring 1 node off Your Path stays selected.
      expect(clear(reduce(s, { type: "select", id: TERAH }, data.label)).selected).toBe(TERAH);
    });

    it("a Selected Node on Your Path that is still in the scene after the clear stays selected", () => {
      // Abraham and Hagar are on Your Path and in Sarah's Ring 1.
      for (const id of [ABRAHAM, HAGAR]) {
        expect(draw(s).nodes.find((n) => n.id === id)!.roles).toEqual(["ring1", "path"]);
        expect(clear(reduce(s, { type: "select", id }, data.label)).selected).toBe(id);
      }
    });

    it("Undo clear with no visits in between gives back Your Path as it was", () => {
      const t = undo(clear(s));
      expect(t.path).toEqual([ABRAHAM, ISAAC, HAGAR]);
      expect(t.notice).toBe("Restored Your Path.");
    });

    it("Undo clear puts the cleared nodes before the visits since, each once, with the Focus off Your Path", () => {
      // Clear, then visit Abraham (cleared before) and Isaac (cleared before, now the Focus).
      const t = walk(clear(s), ABRAHAM, ISAAC);
      expect(t.path).toEqual([SARAH, ABRAHAM]);
      // Hagar comes back first; Abraham keeps his latest visit; Isaac is the Focus, not on Your Path.
      expect(undo(t).path).toEqual([HAGAR, SARAH, ABRAHAM]);
      expect(undo(t).focus).toBe(ISAAC);
    });

    it("Undo clear with nothing cleared changes nothing", () => {
      expect(undo(s)).toEqual(s);
      const t = undo(clear(s));
      expect(undo(t)).toEqual(t);
    });
  });
});

describe("pins and Shared Nodes", () => {
  const [ISAAC, SARAH, TERAH] = ["person:isaac_616", "person:sarah_2473", "person:terah_2841"];
  beforeAll(() => Promise.all([ISAAC, SARAH, TERAH].map(data.load)));
  const act = (s: State, ...actions: Action[]) => actions.reduce((t, a) => reduce(t, a, data.label), s);
  const pin = (id: string): Action => ({ type: "pin", id });
  const focus = (id: string): Action => ({ type: "focus", id });
  // Abraham pinned, then Isaac made the Focus.
  const isaacWithAbraham = () => act(initialState(ABRAHAM), pin(ABRAHAM), focus(ISAAC));

  it("pins at most three nodes; a fourth is refused with a notice", () => {
    const s = act(initialState(ABRAHAM), pin(ISAAC), pin(SARAH), pin(TERAH));
    expect(s.pins).toEqual([ISAAC, SARAH, TERAH]);
    const t = act(s, pin("person:hagar_1348"));
    expect({ ...t, notice: "" }).toEqual({ ...s, notice: "" });
    expect(t.notice).toBe("3 nodes are already pinned. Unpin one first.");
  });

  it("refuses to pin an Overflow Node", () => {
    const s = initialState(ABRAHAM);
    const t = act(s, pin("overflow:theme"));
    expect(t.pins).toEqual([]);
    expect(t.notice).toBe("An Overflow Node cannot be pinned.");
  });

  it("a pinned Focus brings no pin ring until another node is the Focus", () => {
    const s = act(initialState(ABRAHAM), pin(ABRAHAM));
    expect(s.pins).toEqual([ABRAHAM]);
    expect(draw(s).count).toBe(99); // as unpinned (the Ring 1 test above)
    expect(draw(s).edges.filter((e) => e.kind === "pin")).toEqual([]);
    const sc = draw(act(s, focus(ISAAC)));
    expect(sc.nodes.find((n) => n.id === ABRAHAM)?.role).toBe("pinned");
    expect(sc.edges.filter((e) => e.kind === "pin" && e.a === ABRAHAM)).toHaveLength(16);
  });

  it("each pin brings its own top 3 of each type, and no Ring 2", () => {
    const sc = draw(isaacWithAbraham());
    const around = sc.edges.filter((e) => e.kind === "pin" && e.a === ABRAHAM).map((e) => e.b);
    // Fixture: Abraham's top 3 of each type (top 6 in the Ring 1 test above); 1 People Group.
    expect(around).toEqual([
      ...[ISAAC, SARAH, "person:haran_1407"],
      ...["place:ur_1189", "place:beer-lahai-roi_167", "place:canaan_272"],
      ...["event:65", "event:61", "event:66"],
      "group:genealogy_of_jesus",
      ...["theme:god", "theme:genealogy", "theme:covenant"],
      ...["01011031", "01011027", "01011029"],
    ]);
    // Isaac is the Focus and Beer-lahai-roi is in his Ring 1, so they keep those roles.
    expect(sc.nodes.find((n) => n.id === "place:canaan_272")?.role).toBe("pinring");
    expect(sc.nodes.find((n) => n.id === "place:beer-lahai-roi_167")?.role).toBe("ring1");
    // Ring 2 hangs only off Ring 1 (Abraham is also in Isaac's Ring 1), never off a pin ring.
    const pinOnly = new Set(ids(sc, "pinring"));
    expect(sc.nodes.filter((n) => n.role === "ring2" && pinOnly.has(n.via!))).toEqual([]);
  });

  it("unpinning takes the pin and its ring out of the scene", () => {
    const s = isaacWithAbraham();
    const t = act(s, { type: "unpin", id: ABRAHAM });
    expect(t.pins).toEqual([]);
    expect(t.notice).toBe("Unpinned Abraham.");
    const sc = draw(t);
    expect(sc.nodes.some((n) => n.roles.includes("pinned") || n.roles.includes("pinring"))).toBe(false);
    expect(sc.edges.filter((e) => e.kind === "pin")).toEqual([]);
  });

  it("highlights a Shared Node only when it is in the top K of its type for both the Focus and a pin", () => {
    const shared = (s: State) =>
      draw(s)
        .nodes.filter((n) => n.shared)
        .map((n) => n.id);
    // Fixture: 11 nodes on screen are linked to both by any link. Covenant is around Abraham and
    // linked to Isaac, but seventh of Isaac's Themes; Gerar is fourth of Abraham's Places, outside
    // his pin ring, and second of Isaac's.
    expect(shared(isaacWithAbraham())).toEqual(["place:gerar_459", "place:beer-lahai-roi_167", "group:genealogy_of_jesus", "theme:blessing"]);
    // With K = 7 Covenant is in Isaac's top K too.
    const k7 = act(isaacWithAbraham(), { type: "setFilter", key: "k", value: 7 });
    expect(shared(k7)).toContain("theme:covenant");
    // No pin, no Shared Node.
    expect(shared(act(isaacWithAbraham(), { type: "unpin", id: ABRAHAM }))).toEqual([]);
  });

  describe("the node limit with pins (decision 33)", () => {
    // Abraham and Sarah pinned, then Terah and Isaac made the Focus: Your Path is Abraham, Terah.
    // Fixture: 107 nodes wanted, 53 of them Ring 2 and 19 around the pins (9 of them third).
    const s = () => act(initialState(ABRAHAM), pin(ABRAHAM), pin(SARAH), focus(TERAH), focus(ISAAC));
    const at = (n: number) => draw(act(s(), { type: "setFilter", key: "nodeLimit", value: n }));
    const around = (sc: Scene, rank: number) => sc.nodes.filter((n) => n.role === "pinring" && n.rank === rank).length;

    it("trims Ring 2 first, then the oldest of Your Path, then the pin rings", () => {
      expect(at(54).trimmed).toEqual({ ring2: 53, path: 0, pinring: 0 });
      // Terah goes; Abraham stays, as a pin.
      const sc = at(53);
      expect(sc.trimmed).toEqual({ ring2: 53, path: 1, pinring: 0 });
      expect(sc.nodes.some((n) => n.id === TERAH)).toBe(false);
      expect(at(52).trimmed).toEqual({ ring2: 53, path: 1, pinring: 1 });
    });

    it("takes each pin's third neighbours before any pin's second", () => {
      const sc = at(44);
      expect(sc.trimmed.pinring).toBe(9);
      expect([around(sc, 0), around(sc, 1), around(sc, 2)]).toEqual([7, 3, 0]);
    });

    it("never trims the Focus, the pins, Ring 1, or Overflow Nodes", () => {
      const sc = at(10);
      // 1 Focus, 28 Ring 1 (Abraham among them), Sarah, 4 Overflow Nodes.
      expect([sc.count, sc.demand, sc.hidden]).toEqual([34, 107, 73]);
      expect(sc.nodes.filter((n) => n.roles.includes("pinned")).map((n) => n.id)).toEqual([ABRAHAM, SARAH]);
      expect(ids(sc, "focus")).toEqual([ISAAC]);
      expect(sc.nodes.filter((n) => n.roles.includes("ring1"))).toHaveLength(28);
      expect(ids(sc, "overflow")).toHaveLength(4);
    });
  });
});

describe("Relationship words on the Focus edges", () => {
  it("reads each Ring 1 link from the Focus, with the gender of each relative", () => {
    const words = Object.fromEntries(
      draw(initialState(ABRAHAM))
        .edges.filter((e) => e.kind === "focus")
        .map((e) => [e.b, e.dashed ? `${e.label} (dashed)` : e.label]),
    );
    // Fixture edges in Abraham's file: Hagar is a curated wife and concubine; Canaan and Genealogy
    // are only Co-mentions (2 and 6 shared Verses).
    expect(words).toMatchObject({
      "person:isaac_616": "son",
      "person:sarah_2473": "wife",
      "person:hagar_1348": "wife, concubine",
      "person:haran_1407": "brother",
      "person:terah_2841": "father",
      "place:ur_1189": "birthplace",
      "event:65": "took part",
      "group:genealogy_of_jesus": "member of",
      "place:canaan_272": "together in 2 verses (dashed)",
      "theme:genealogy": "together in 6 verses (dashed)",
    });
  });

  // One link from the Focus to a Neighbour of the given gender, with these edges.
  const words = (gender: string | undefined, type: NodeType, ...edges: Edge[]) =>
    relation({ id: "n", type, weight: 3, edges }, () => gender).text;
  const out = (edge: string, role?: string): Edge => ({ edge, direction: "out", role });
  const inn = (edge: string, role?: string): Edge => ({ edge, direction: "in", role });
  const both = (edge: string): Edge => ({ edge, direction: "both" });

  it("names family by the relative's gender, or a neutral word when it is unknown", () => {
    const byGender = (...edges: Edge[]) => ["Male", "Female", undefined].map((g) => words(g, "person", ...edges));
    expect(byGender(out("PARENT_OF", "father"))).toEqual(["son", "daughter", "child"]);
    expect(byGender(inn("PARENT_OF"))).toEqual(["father", "mother", "parent"]);
    expect(byGender(inn("PARENT_OF", "mother"))).toEqual(["mother", "mother", "mother"]); // the stated role wins
    expect(byGender(both("SPOUSE_OF"))).toEqual(["husband", "wife", "spouse"]);
    expect(byGender(both("SIBLING_OF"))).toEqual(["brother", "sister", "sibling"]);
    expect(byGender(both("HALF_SIBLING_OF"))).toEqual(["half-brother", "half-sister", "half-sibling"]);
  });

  it("names curated partners: a concubine, and a spouse before a concubine", () => {
    expect(words("Female", "person", inn("CONCUBINE_OF"))).toBe("concubine");
    expect(words("Female", "person", inn("CONCUBINE_OF"), both("SPOUSE_OF"))).toBe("wife, concubine");
    // Read from the concubine: the man is her partner, or her husband when they also married.
    expect(words("Male", "person", out("CONCUBINE_OF"))).toBe("partner");
    expect(words("Male", "person", out("CONCUBINE_OF"), both("SPOUSE_OF"))).toBe("husband");
    expect(words("Female", "person", both("PARTNER_OF"))).toBe("partner");
    expect(words("Male", "person", both("POSSIBLY_SAME_AS"))).toBe("possibly the same person");
  });

  it("names places, events, and People Groups from the Focus's side", () => {
    expect([words(undefined, "place", out("BORN_AT")), words(undefined, "person", inn("BORN_AT"))]).toEqual(["birthplace", "born here"]);
    expect([words(undefined, "place", out("DIED_AT")), words(undefined, "person", inn("DIED_AT"))]).toEqual(["place of death", "died here"]);
    expect(words(undefined, "event", out("PARTICIPATED_IN"))).toBe("took part");
    expect([words(undefined, "place", out("OCCURRED_AT")), words(undefined, "event", inn("OCCURRED_AT"))]).toEqual([
      "where it happened",
      "happened here",
    ]);
    expect([words(undefined, "group", out("MEMBER_OF")), words(undefined, "person", inn("MEMBER_OF"))]).toEqual(["member of", "member"]);
  });

  it("falls back to a Co-mention, then to how a Verse links", () => {
    const co = (n: number): Edge => ({ edge: "CO_MENTION", direction: "both", shared_verses: n });
    expect(relation({ id: "n", type: "place", weight: 1, edges: [co(1)] }, () => undefined)).toEqual({ text: "together in 1 verse", derived: true });
    expect(words(undefined, "theme", co(6))).toBe("together in 6 verses");
    expect(words("Male", "person", co(6), both("SIBLING_OF"))).toBe("brother"); // stated words win
    expect(words(undefined, "verse", out("CROSS_REF"))).toBe("cross-reference, 3 votes");
    expect([words(undefined, "verse", inn("MENTIONS")), words(undefined, "person", out("MENTIONS"))]).toEqual(["named in this verse", "named"]);
    expect([words(undefined, "verse", inn("FILED_UNDER")), words(undefined, "theme", out("FILED_UNDER"))]).toEqual(["filed here", "filed under"]);
  });
});

describe("a Verse as the Focus", () => {
  const GEN_25_5 = "01025005",
    GEN_25_8 = "01025008";
  beforeAll(async () => {
    await data.load(GEN_25_5);
    await data.load(GEN_25_8);
  });
  const verseFocus = (id: string, minVotes = 1) =>
    draw(reduce(initialState(id), { type: "setFilter", key: "minVotes", value: minVotes }, data.label));

  it("ranks its Entities of each type by the build weight, then ID, and Cross-references by Votes", () => {
    const sc = verseFocus(GEN_25_5);
    // Fixture weights, ln(31,102 / whole-Bible Verse count) (decision 121): Isaac 6.3747 is rarer
    // than Abraham 6.1706; HEIR and WILL tie at 9.2464, before INHERITANCE at 8.9587.
    expect(ring1Of(sc, "person")).toEqual(["person:isaac_616", "person:abraham_58"]);
    expect(ring1Of(sc, "theme")).toEqual(["theme:heir", "theme:will", "theme:inheritance"]);
    // 15 Cross-references: two with 5 Votes, then the first four of five with 4 Votes, by ID.
    expect(ring1Of(sc, "verse")).toEqual(["48003029", "58001002", "19068018", "43003035", "45008017", "45008032"]);
    expect(sc.nodes.find((n) => n.id === "overflow:verse")?.count).toBe(9);
  });

  it("leaves Cross-references under the Vote Limit out of Ring 1", () => {
    const sc = verseFocus(GEN_25_5, 5);
    expect(ring1Of(sc, "verse")).toEqual(["48003029", "58001002"]);
    expect(ids(sc, "overflow")).toEqual([]);
  });

  it("leaves Cross-references under the Vote Limit out of Ring 2", () => {
    // Gen 25:17 is in Gen 25:8's Ring 1 (11 Votes). Its own Cross-references, after Gen 25:8:
    // Gen 25:7 (3 Votes), Deut 32:50 (3), Num 20:24 (2).
    const via = (sc: Scene) => sc.nodes.filter((n) => n.role === "ring2" && n.via === "01025017").map((n) => n.id);
    expect(via(verseFocus(GEN_25_8))).toEqual(["01025007", "05032050", "04020024"]);
    expect(via(verseFocus(GEN_25_8, 3))).toEqual(["01025007", "05032050"]);
  });
});
