import { beforeAll, describe, expect, it } from "vitest";
import { createData, type Data } from "../src/data";
import { afterClear, hiddenNote, initialState, passes, reduce, relation, relationWords, scene, type Action, type Edge, type Link, type NodeType, type Scene, type State } from "../src/model";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58";
let data: Data;

beforeAll(async () => {
  data = await createData(readExport, "");
  await data.loadWithKin(ABRAHAM);
});

const draw = (s: State) => scene(s, data.record, data.genderOf, data.bookOf);
const ids = (drawn: Scene, role: string) => drawn.nodes.filter((n) => n.role === role).map((n) => n.id);
const ring1Of = (drawn: Scene, type: string) =>
  drawn.nodes.filter((n) => n.role === "ring1" && n.type === type).sort((a, b) => a.ring1!.pos - b.ring1!.pos).map((n) => n.id);
const limit = (n: number) => reduce(initialState(ABRAHAM), { type: "setFilter", key: "nodeLimit", value: n }, data.label);

describe("Abraham as the Focus, K = 6", () => {
  it("puts the top 6 of each type in Ring 1, by weight then ID", () => {
    const drawn = draw(initialState(ABRAHAM));
    // Fixture weights (cosine; for Themes decision 111; for Verses the other Entities in them).
    expect(ring1Of(drawn, "person")).toEqual([
      "person:isaac_616", // 0.5081
      "person:sarah_2473", // 0.3107
      "person:israel_682", // 0.2616, with Abraham in Matt 1:2
      "person:haran_1407",
      "person:nahor_2143",
      "person:hagar_1348", // 0.1937; Terah (0.1838) is seventh
    ]);
    // Only 6 Places: Beer-lahai-roi and Canaan tie at 0.1162, Gerar and Haran at 0.052.
    expect(ring1Of(drawn, "place")).toEqual([
      "place:ur_1189",
      "place:beer-lahai-roi_167",
      "place:canaan_272",
      "place:gerar_459",
      "place:haran_527",
      "place:babylon_151",
    ]);
    // Bastard and Heir tie at 27.7392.
    expect(ring1Of(drawn, "theme")).toEqual([
      "theme:genealogy",
      "theme:god",
      "theme:blessing",
      "theme:covenant",
      "theme:bastard",
      "theme:heir",
    ]);
    // Gen 11:27 and 11:29 both have 8 other Entities.
    expect(ring1Of(drawn, "verse")).toEqual(["01011031", "01011027", "01011029", "01011026", "01016005", "01016003"]);
    expect(ring1Of(drawn, "group")).toEqual(["group:genealogy_of_jesus"]);
  });

  it("breaks a tie at the edge of Ring 1 by ID", () => {
    // Abraham enters Canaan (event:71) and event:77 tie at 0.0822 for the sixth Event place.
    const events = ring1Of(draw(initialState(ABRAHAM)), "event");
    expect(events).toEqual(["event:65", "event:61", "event:66", "event:88", "event:76", "event:71"]);
  });

  it("adds one Overflow Node for each type with more Neighbours, with its count", () => {
    const overflow = draw(initialState(ABRAHAM)).nodes.filter((n) => n.role === "overflow");
    // Fixture: 24 People, 7 Events, 37 Themes, 29 Verses; 6 Places and 1 People Group fit.
    expect(Object.fromEntries(overflow.map((n) => [n.id, n.count]))).toEqual({
      "overflow:person": 18,
      "overflow:event": 1,
      "overflow:theme": 31,
      "overflow:verse": 23,
    });
  });

  it("fills Ring 2 from each Ring 1 node's stored top 10, skipping nodes already on screen", () => {
    const drawn = draw(initialState(ABRAHAM));
    const via = (id: string) => drawn.nodes.filter((n) => n.role === "ring2" && n.via === id).map((n) => n.id);
    // Isaac's stored list starts with Abraham, the Focus, and Israel (Ring 1).
    expect(via("person:isaac_616")).toEqual(["person:rebekah_2401", "theme:wells", "person:abimelech_40"]);
    // Sarah's starts with Hagar (Ring 1) and Abraham.
    expect(via("person:sarah_2473")).toEqual(["person:heth_1510", "person:iscah_618", "person:milcah_2082"]);
    expect(ids(drawn, "ring2")).toHaveLength(69);
    expect(drawn.count).toBe(105); // 1 Focus, 31 Ring 1, 4 Overflow Nodes, 69 Ring 2
  });
});

describe("the node limit (decision 33)", () => {
  it("trims Ring 2 only, and says how many are hidden", () => {
    const drawn = draw(limit(60));
    expect([drawn.count, drawn.demand, drawn.hidden]).toEqual([60, 105, 45]);
    expect(drawn.trimmed).toEqual({ ring2: 45, path: 0, pinring: 0 });
    expect(ids(drawn, "ring1")).toHaveLength(31);
    expect(ids(drawn, "overflow")).toHaveLength(4);
  });

  it("gives a corner note only when nodes are hidden", () => {
    expect(hiddenNote(draw(limit(60)))).toBe("45 nodes hidden to keep the view fast");
    expect(hiddenNote(draw(initialState(ABRAHAM)))).toBe("");
  });

  it("takes each parent's third Ring 2 node before any parent's second", () => {
    // Fixture: 29 Ring 1 nodes have Ring 2, with 29 first, 22 second, and 18 third neighbours.
    // A limit of 70 leaves room for 34 Ring 2 nodes: every first, and 5 seconds.
    const full = draw(initialState(ABRAHAM)).nodes.filter((n) => n.role === "ring2");
    const kept = draw(limit(70)).nodes.filter((n) => n.role === "ring2");
    const byRank = (k: number) => kept.filter((n) => n.rank === k);
    expect([byRank(0).length, byRank(1).length, byRank(2).length]).toEqual([29, 5, 0]);
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
    const drawn = draw(s);
    // Abraham, the oldest, is left out. Isaac and Jacob are also in Rebekah's Ring 1 and drawn there.
    const onPath = drawn.nodes.filter((n) => n.roles.includes("path")).map((n) => n.id);
    expect(onPath.sort()).toEqual([ISAAC, SARAH, HAGAR, TERAH, JACOB].sort());
    // One path line: the Focus, then the newest to the oldest drawn.
    const line = drawn.edges.filter((e) => e.kind === "path").map((e) => [e.a, e.b]);
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
    expect(draw(s).count).toBe(105); // as unpinned (the Ring 1 test above)
    expect(draw(s).edges.filter((e) => e.kind === "pin")).toEqual([]);
    const drawn = draw(act(s, focus(ISAAC)));
    expect(drawn.nodes.find((n) => n.id === ABRAHAM)?.role).toBe("pinned");
    expect(drawn.edges.filter((e) => e.kind === "pin" && e.a === ABRAHAM)).toHaveLength(16);
  });

  it("each pin brings its own top 3 of each type, and no Ring 2", () => {
    const drawn = draw(isaacWithAbraham());
    const around = drawn.edges.filter((e) => e.kind === "pin" && e.a === ABRAHAM).map((e) => e.b);
    // Fixture: Abraham's top 3 of each type (top 6 in the Ring 1 test above); 1 People Group.
    expect(around).toEqual([
      ...[ISAAC, SARAH, "person:israel_682"],
      ...["place:ur_1189", "place:beer-lahai-roi_167", "place:canaan_272"],
      ...["event:65", "event:61", "event:66"],
      "group:genealogy_of_jesus",
      ...["theme:genealogy", "theme:god", "theme:blessing"],
      ...["01011031", "01011027", "01011029"],
    ]);
    // Isaac is the Focus and Beer-lahai-roi is in his Ring 1, so they keep those roles.
    expect(drawn.nodes.find((n) => n.id === "place:canaan_272")?.role).toBe("pinring");
    expect(drawn.nodes.find((n) => n.id === "place:beer-lahai-roi_167")?.role).toBe("ring1");
    // Ring 2 hangs only off Ring 1 (Abraham is also in Isaac's Ring 1), never off a pin ring.
    const pinOnly = new Set(ids(drawn, "pinring"));
    expect(drawn.nodes.filter((n) => n.role === "ring2" && pinOnly.has(n.via!))).toEqual([]);
  });

  it("unpinning takes the pin and its ring out of the scene", () => {
    const s = isaacWithAbraham();
    const t = act(s, { type: "unpin", id: ABRAHAM });
    expect(t.pins).toEqual([]);
    expect(t.notice).toBe("Unpinned Abraham.");
    const drawn = draw(t);
    expect(drawn.nodes.some((n) => n.roles.includes("pinned") || n.roles.includes("pinring"))).toBe(false);
    expect(drawn.edges.filter((e) => e.kind === "pin")).toEqual([]);
  });

  it("highlights a Shared Node only when it is in the top K of its type for both the Focus and a pin", () => {
    const shared = (s: State) =>
      draw(s)
        .nodes.filter((n) => n.shared)
        .map((n) => n.id);
    // Fixture: many nodes on screen are linked to both by any link. Covenant is in Abraham's top
    // K and linked to Isaac, but seventh of Isaac's Themes; Gerar is fourth of Abraham's Places,
    // outside his pin ring, and first of Isaac's. Israel is around Abraham and second of Isaac's.
    expect(shared(isaacWithAbraham())).toEqual(["person:israel_682", "place:gerar_459", "place:beer-lahai-roi_167", "group:genealogy_of_jesus", "theme:blessing"]);
    // With K = 7 Covenant is in Isaac's top K too.
    const k7 = act(isaacWithAbraham(), { type: "setFilter", key: "k", value: 7 });
    expect(shared(k7)).toContain("theme:covenant");
    // No pin, no Shared Node.
    expect(shared(act(isaacWithAbraham(), { type: "unpin", id: ABRAHAM }))).toEqual([]);
  });

  describe("the node limit with pins (decision 33)", () => {
    // Abraham and Sarah pinned, then Terah and Isaac made the Focus: Your Path is Abraham, Terah.
    // Fixture: 105 nodes wanted, 53 of them Ring 2 and 17 around the pins (7 of them third).
    const s = () => act(initialState(ABRAHAM), pin(ABRAHAM), pin(SARAH), focus(TERAH), focus(ISAAC));
    const at = (n: number) => draw(act(s(), { type: "setFilter", key: "nodeLimit", value: n }));
    const around = (drawn: Scene, rank: number) => drawn.nodes.filter((n) => n.role === "pinring" && n.rank === rank).length;

    it("trims Ring 2 first, then the oldest of Your Path, then the pin rings", () => {
      expect(at(52).trimmed).toEqual({ ring2: 53, path: 0, pinring: 0 });
      // Terah goes; Abraham stays, as a pin.
      const drawn = at(51);
      expect(drawn.trimmed).toEqual({ ring2: 53, path: 1, pinring: 0 });
      expect(drawn.nodes.some((n) => n.id === TERAH)).toBe(false);
      expect(at(50).trimmed).toEqual({ ring2: 53, path: 1, pinring: 1 });
    });

    it("takes each pin's third neighbours before any pin's second", () => {
      const drawn = at(44);
      expect(drawn.trimmed.pinring).toBe(7);
      expect([around(drawn, 0), around(drawn, 1), around(drawn, 2)]).toEqual([7, 3, 0]);
    });

    it("never trims the Focus, the pins, Ring 1, or Overflow Nodes", () => {
      const drawn = at(10);
      // 1 Focus, 28 Ring 1 (Abraham among them), Sarah, 4 Overflow Nodes.
      expect([drawn.count, drawn.demand, drawn.hidden]).toEqual([34, 105, 71]);
      expect(drawn.nodes.filter((n) => n.roles.includes("pinned")).map((n) => n.id)).toEqual([ABRAHAM, SARAH]);
      expect(ids(drawn, "focus")).toEqual([ISAAC]);
      expect(drawn.nodes.filter((n) => n.roles.includes("ring1"))).toHaveLength(28);
      expect(ids(drawn, "overflow")).toHaveLength(4);
    });
  });
});

describe("Relationship words on the Focus edges", () => {
  it("reads each Ring 1 link from the Focus, with the gender of each relative", () => {
    // K = 7 keeps Terah, seventh of Abraham's People since Israel (Matt 1:2) joined.
    const k7 = reduce(initialState(ABRAHAM), { type: "setFilter", key: "k", value: 7 }, data.label);
    const words = Object.fromEntries(
      draw(k7)
        .edges.filter((e) => e.kind === "focus")
        .map((e) => [e.b, e.dashed ? `${e.label} (dashed)` : e.label]),
    );
    // Fixture edges in Abraham's file: Hagar is a curated wife and concubine; Canaan and Genealogy
    // are only Co-mentions (2 and 8 shared Verses). A People Group and a Theme show no fixed words
    // (decision 141).
    expect(words).toMatchObject({
      "person:isaac_616": "son",
      "person:sarah_2473": "wife",
      "person:hagar_1348": "wife, concubine",
      "person:haran_1407": "brother",
      "person:terah_2841": "father",
      "place:ur_1189": "birthplace",
      "event:65": "took part",
      "group:genealogy_of_jesus": "",
      "place:canaan_272": "together in 2 verses (dashed)",
      "theme:genealogy": "8 verses (dashed)",
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

  it("names the node the words are read from, for family and partner words only", () => {
    const link = (gender: string | undefined, ...edges: Edge[]) => ({ link: { id: "n", type: "person" as const, weight: 3, edges }, gender });
    const said = ({ link: l, gender }: ReturnType<typeof link>) => relation(l, () => gender, "Benjamin").text;
    expect(said(link("Male", out("PARENT_OF")))).toBe("son of Benjamin");
    expect(said(link("Female", both("SPOUSE_OF")))).toBe("wife of Benjamin");
    expect(said(link(undefined, both("POSSIBLY_SAME_AS")))).toBe("possibly the same person as Benjamin");
    // Benjamin's list: a group he belongs to; a group's list: a member of it.
    expect(said(link(undefined, out("MEMBER_OF")))).toBe("Benjamin is a member");
    expect(said(link("Male", inn("MEMBER_OF")))).toBe("member of Benjamin");
    expect(said(link(undefined, { edge: "CO_MENTION", direction: "both", shared_verses: 2 }))).toBe("together in 2 verses");
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

describe("Relationship words that never vary for a pair of node types are dropped (decision 141)", () => {
  const link = (type: NodeType, weight: number, ...edges: Edge[]): Link => ({ id: "n", type, weight, edges });
  const shown = (owner: NodeType, l: Link, gender?: string) => relationWords(owner, l, () => gender);
  const co = (n: number): Edge => ({ edge: "CO_MENTION", direction: "both", shared_verses: n });
  const one = (edge: string, direction: Edge["direction"]): Edge => ({ edge, direction });

  it("shows nothing between a Verse and the Entities it names or is filed under", () => {
    for (const t of ["person", "place", "event"] as const) {
      expect(shown("verse", link(t, 1, one("MENTIONS", "out")))).toEqual({ text: "", derived: false });
      expect(shown(t, link("verse", 1, one("MENTIONS", "in"))).text).toBe("");
    }
    expect(shown("verse", link("theme", 1, one("FILED_UNDER", "out"))).text).toBe("");
    expect(shown("theme", link("verse", 1, one("FILED_UNDER", "in"))).text).toBe("");
  });

  it("shows the Subheadings that file a Verse under a Theme", () => {
    const filed = (direction: Edge["direction"]): Edge => ({ edge: "FILED_UNDER", direction, subheadings: ["A designation of the Jews", "Fellow-worker"] });
    expect(shown("verse", link("theme", 1, filed("out"))).text).toBe("A designation of the Jews; Fellow-worker");
    expect(shown("theme", link("verse", 1, filed("in"))).text).toBe("A designation of the Jews; Fellow-worker");
  });

  it("shows only the Votes between two Verses", () => {
    expect(shown("verse", link("verse", 43, one("CROSS_REF", "out"), one("CROSS_REF", "in")))).toEqual({ text: "43 votes", derived: false });
    expect(shown("verse", link("verse", 1, one("CROSS_REF", "in"))).text).toBe("1 vote");
  });

  it("shows nothing between a People Group and its members", () => {
    expect(shown("group", link("person", 0, one("MEMBER_OF", "in")), "Male").text).toBe("");
    expect(shown("person", link("group", 0, one("MEMBER_OF", "out"))).text).toBe("");
  });

  it("shows only the shared Verse count for pairs that only ever link by Co-mention", () => {
    for (const [owner, t] of [["theme", "person"], ["person", "theme"], ["place", "theme"], ["theme", "event"], ["theme", "theme"], ["place", "place"], ["event", "event"]] as const)
      expect(shown(owner, link(t, 1, co(18)))).toEqual({ text: "18 verses", derived: true });
    expect(shown("place", link("place", 1, co(1))).text).toBe("1 verse");
  });

  it("keeps the words of mixed pairs, Co-mentions included", () => {
    expect(shown("person", link("person", 1, co(18), one("SIBLING_OF", "both")), "Female").text).toBe("sister");
    expect(shown("person", link("person", 1, co(18))).text).toBe("together in 18 verses");
    expect(shown("person", link("event", 1, one("PARTICIPATED_IN", "out"))).text).toBe("took part");
    expect(shown("event", link("person", 1, co(2))).text).toBe("together in 2 verses");
    expect(shown("person", link("place", 1, one("BORN_AT", "out"))).text).toBe("birthplace");
    expect(shown("place", link("event", 1, co(3)))).toEqual({ text: "together in 3 verses", derived: true });
    expect(shown("event", link("place", 1, one("OCCURRED_AT", "out"))).text).toBe("where it happened");
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
    const drawn = verseFocus(GEN_25_5);
    // Fixture weights, ln(31,102 / whole-Bible Verse count) (decision 121): Isaac 6.3747 is rarer
    // than Abraham 6.1706; HEIR and WILL tie at 9.2464, before INHERITANCE at 8.9587.
    expect(ring1Of(drawn, "person")).toEqual(["person:isaac_616", "person:abraham_58"]);
    expect(ring1Of(drawn, "theme")).toEqual(["theme:heir", "theme:will", "theme:inheritance"]);
    // 13 Cross-references: two with 5 Votes, then the four with 4 Votes, by ID.
    expect(ring1Of(drawn, "verse")).toEqual(["48003029", "58001002", "19068018", "45008017", "45008032", "46003021"]);
    expect(drawn.nodes.find((n) => n.id === "overflow:verse")?.count).toBe(7);
  });

  it("leaves Cross-references under the Vote Limit out of Ring 1", () => {
    const drawn = verseFocus(GEN_25_5, 5);
    expect(ring1Of(drawn, "verse")).toEqual(["48003029", "58001002"]);
    expect(ids(drawn, "overflow")).toEqual([]);
  });

  it("leaves Cross-references under the Vote Limit out of Ring 2", () => {
    // Gen 25:17 is in Gen 25:8's Ring 1 (11 Votes). Its own Cross-references, after Gen 25:8:
    // Gen 25:7 (3 Votes), Deut 32:50 (3), Num 20:24 (2).
    const via = (drawn: Scene) => drawn.nodes.filter((n) => n.role === "ring2" && n.via === "01025017").map((n) => n.id);
    expect(via(verseFocus(GEN_25_8))).toEqual(["01025007", "05032050", "04020024"]);
    expect(via(verseFocus(GEN_25_8, 3))).toEqual(["01025007", "05032050"]);
  });
});

describe("type and book filters", () => {
  const [ISAAC, GOD, GEN_16_1, GEN_25_8] = ["person:isaac_616", "theme:god", "01016001", "01025008"];
  beforeAll(() => Promise.all([ISAAC, GOD, GEN_16_1, GEN_25_8].map(data.load)));
  const act = (s: State, ...actions: Action[]) => actions.reduce((t, a) => reduce(t, a, data.label), s);
  const hide = (...types: NodeType[]): Action => ({ type: "setFilter", key: "hidden", value: types });
  const books = (value: State["filters"]["books"]): Action => ({ type: "setFilter", key: "books", value });
  const roles = (drawn: Scene, type: NodeType) => [...new Set(drawn.nodes.filter((n) => n.type === type).map((n) => n.role))].sort();
  // Abraham and God (a Theme) pinned, Isaac the Focus, Sarah selected.
  const isaac = () =>
    act(initialState(ABRAHAM), { type: "pin", id: ABRAHAM }, { type: "pin", id: GOD }, { type: "focus", id: ISAAC }, { type: "select", id: "person:sarah_2473" });

  it("a hidden type leaves Ring 1, its Overflow Node, Ring 2, pin rings, and Shared Nodes; the Focus and pins stay", () => {
    const shown = draw(isaac());
    expect(roles(shown, "theme")).toEqual(["overflow", "pinned", "pinring", "ring1", "ring2"]);
    expect(shown.nodes.filter((n) => n.shared && n.type === "theme").map((n) => n.id)).toEqual(["theme:blessing"]);

    const s = act(isaac(), hide("theme"));
    expect(s.selected).toBe("person:sarah_2473");
    const drawn = draw(s);
    expect(drawn.nodes.filter((n) => n.type === "theme").map((n) => [n.id, n.role])).toEqual([[GOD, "pinned"]]);
    expect(ring1Of(drawn, "person")).toEqual(ring1Of(shown, "person"));
    // A hidden Focus type still shows the Focus.
    expect(ids(draw(act(initialState(GOD), hide("theme"))), "focus")).toEqual([GOD]);
  });

  it("a hidden type frees room under the node limit", () => {
    // Fixture: 105 nodes wanted with Themes, 45 hidden at a limit of 60 (above).
    const drawn = draw(act(limit(60), hide("theme")));
    expect([drawn.demand, drawn.hidden]).toEqual([71, 11]);
  });

  it("the book filter hides only Verses", () => {
    const shown = draw(initialState(ABRAHAM));
    const drawn = draw(act(initialState(ABRAHAM), books(["3John"]))); // Abraham is in Matt 1 too
    expect(roles(drawn, "verse")).toEqual([]);
    for (const t of ["person", "place", "event", "group", "theme"] as const) expect(ring1Of(drawn, t)).toEqual(ring1Of(shown, t));
  });

  it("Verses outside this build leave Ring 1 and Ring 2", () => {
    // Stand-in for Gen 22:2 and its Cross-references to John, Romans, and Hebrews (Gen 22 is not in
    // the fixture build): Gen 16:1 has Cross-references to Galatians, Judges, and Luke.
    expect(ring1Of(draw(initialState(GEN_16_1)), "verse")).toEqual(["48004024", "07013002", "01011030", "01025021", "42001007", "42001036"]);
    const drawn = draw(act(initialState(GEN_16_1), books("build")));
    expect(ring1Of(drawn, "verse")).toEqual(["01011030", "01025021", "01016008"]);
    expect(ids(drawn, "overflow")).not.toContain("overflow:verse");
    // Gen 25:8's Ring 2 Verses: Deut 32:50 and Num 20:24 (from Gen 25:17's Cross-references) go.
    const ring2Verses = (d: Scene) => ids(d, "ring2").filter((id) => /^\d+$/.test(id));
    expect(ring2Verses(draw(initialState(GEN_25_8)))).toContain("05032050");
    expect(ring2Verses(draw(act(initialState(GEN_25_8), books("build"))))).toEqual([]);
  });

  it("a chosen book hides Verses of the other books in the build too", () => {
    // Fixture: Gen 16:1's Cross-references in the build are all in Genesis.
    expect(ring1Of(draw(act(initialState(GEN_16_1), books(["Gen"]))), "verse")).toEqual(["01011030", "01025021", "01016008"]);
    expect(ring1Of(draw(act(initialState(GEN_16_1), books(["Matt"]))), "verse")).toEqual([]);
  });

  it("a chosen book keeps its chapters outside this build; only This build hides them", () => {
    // Fixture: no link reaches an unbuilt chapter of a built book, so a Cross-reference to Gen 22:2
    // (Gen 22 is not built) stands in.
    const gen22: Link = { id: "01022002", type: "verse", weight: 5, edges: [{ edge: "CROSS_REF", direction: "out" }] };
    const filters = (value: State["filters"]["books"]) => ({ ...initialState(ABRAHAM).filters, books: value });
    expect(passes(gen22, filters(["Gen"]), data.bookOf)).toBe(true);
    expect(passes(gen22, filters(["Matt"]), data.bookOf)).toBe(false);
    expect(passes(gen22, filters("build"), data.bookOf)).toBe(false);
  });
});
