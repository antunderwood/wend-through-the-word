import { beforeAll, describe, expect, it } from "vitest";
import { createData, type Data } from "../src/data";
import { VIEWS } from "../src/graph";
import { initialState, reduce, scene, type Scene, type View } from "../src/model";
import { layout } from "../src/views/view";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58",
  TERAH = "person:terah_2841",
  ISAAC = "person:isaac_616";
let data: Data, sc: Scene;

beforeAll(async () => {
  data = await createData(readExport, "");
  for (const id of [ABRAHAM, TERAH, ISAAC]) await data.load(id);
  // Every role on screen: Isaac the Focus, Abraham pinned with his ring, Terah on Your Path (Abraham too, drawn as the pin).
  let s = initialState(ABRAHAM);
  for (const a of [
    { type: "focus", id: TERAH },
    { type: "focus", id: ISAAC },
    { type: "pin", id: ABRAHAM },
  ] as const)
    s = reduce(s, a, data.label);
  sc = scene(s, data.rec, data.genderOf);
});

describe("the views (decision 114)", () => {
  it("are the tilted plane, stacked discs, and free orbit", () => {
    expect(Object.keys(VIEWS)).toEqual(["A", "B", "C"]);
  });

  it.each(["A", "B", "C"] as View[])("view %s places every node of the Scene, adding none", (key) => {
    expect(new Set(sc.nodes.map((n) => n.role))).toEqual(new Set(["focus", "ring1", "overflow", "ring2", "pinned", "pinring", "path"]));
    const at = layout(sc, VIEWS[key].place);
    expect([...at.keys()].sort()).toEqual(sc.nodes.map((n) => n.id).sort());
    for (const p of at.values()) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
  });

  it("stacks the Focus above Ring 1, and Ring 1 above Ring 2, in view B", () => {
    const at = layout(sc, VIEWS.B.place);
    const heights = (role: string) => new Set(sc.nodes.filter((n) => n.role === role).map((n) => at.get(n.id)!.y));
    const [focus, ring1, ring2] = [heights("focus"), heights("ring1"), heights("ring2")].map((h) => [...h]);
    expect([focus.length, ring1.length, ring2.length]).toEqual([1, 1, 1]); // one disc each
    expect(focus[0]).toBeGreaterThan(ring1[0]);
    expect(ring1[0]).toBeGreaterThan(ring2[0]);
  });
});
