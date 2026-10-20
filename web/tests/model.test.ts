import { beforeAll, describe, expect, it } from "vitest";
import { createData, type Data } from "../src/data";
import { initialState, reduce, scene, type Scene, type State } from "../src/model";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58";
let data: Data;

beforeAll(async () => {
  data = await createData(readExport, "");
  await data.load(ABRAHAM);
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
