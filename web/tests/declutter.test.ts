import { beforeAll, describe, expect, it } from "vitest";
import { createData, type Data } from "../src/data";
import { namePriority, uncrowded } from "../src/declutter";
import { initialState, reduce, scene, type Scene } from "../src/model";
import { readExport } from "./fixture";

const box = (left: number, top: number, width = 40, height = 10) => ({ left, top, right: left + width, bottom: top + height });

describe("names that would overlap a more important one are hidden", () => {
  it("keeps a name that overlaps nothing", () => {
    expect(uncrowded([{ box: box(0, 0), priority: 5 }])).toEqual([true]);
  });

  it("hides the less important of two overlapping names, whatever their order", () => {
    expect(uncrowded([{ box: box(0, 0), priority: 9 }, { box: box(20, 5), priority: 1 }])).toEqual([false, true]);
  });

  it("names that only touch at an edge do not overlap", () => {
    expect(uncrowded([{ box: box(0, 0), priority: 1 }, { box: box(40, 0), priority: 2 }])).toEqual([true, true]);
  });
});

describe("the order names are placed in (decision 124)", () => {
  const ABRAHAM = "person:abraham_58",
    ISAAC = "person:isaac_616",
    REBEKAH = "person:rebekah_2401";
  let drawn: Scene;
  beforeAll(async () => {
    const data: Data = await createData(readExport, "");
    for (const id of [ABRAHAM, ISAAC]) await data.load(id);
    let s = initialState(ABRAHAM);
    for (const a of [
      { type: "pin", id: ABRAHAM },
      { type: "focus", id: ISAAC },
    ] as const)
      s = reduce(s, a, data.label);
    drawn = scene(s, data.record, data.genderOf);
  });
  // The labelled nodes, most important first, as role and rank (place in its sector, or in its pin's ring).
  const order = (selected: string) =>
    drawn.nodes
      .filter((n) => n.role !== "ring2" && n.role !== "path")
      .sort((a, b) => namePriority(a, selected) - namePriority(b, selected))
      .map((n) => (n.id === selected ? "selected" : n.role === "ring1" ? `ring1 ${n.ring1!.pos}` : n.role === "pinring" ? `pinring ${n.rank}` : n.role));

  it("places the Selected Node, the Focus, Pinned Nodes, Ring 1 by rank across types, Overflow Nodes, then the names around pins by rank", () => {
    const got = order(REBEKAH);
    expect(got.slice(0, 3)).toEqual(["selected", "focus", "pinned"]);
    const rest = got.slice(3),
      kind = (r: string) => r.split(" ")[0],
      rank = (r: string) => Number(r.split(" ")[1]);
    expect(rest.map(kind)).toEqual(["ring1", "overflow", "pinring"].flatMap((k) => rest.map(kind).filter((x) => x === k)));
    for (const k of ["ring1", "pinring"]) {
      const ranks = rest.filter((r) => kind(r) === k).map(rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
    // Rank 0 of every type comes before rank 1 of any.
    expect(rest.slice(0, 5)).toEqual(["ring1 0", "ring1 0", "ring1 0", "ring1 0", "ring1 0"]);
  });

  it("puts the Focus first when it is the Selected Node", () => {
    expect(order(ISAAC).slice(0, 2)).toEqual(["selected", "pinned"]);
  });
});
