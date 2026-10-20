import { describe, expect, it } from "vitest";
import { TYPES } from "../src/model";
import { COUNTS, synthetic } from "../src/synthetic";

describe("synthetic scenes for the node limit test page", () => {
  it("come in 100, 250, 500, 750, and 1,000 nodes", () => {
    expect(COUNTS).toEqual([100, 250, 500, 750, 1000]);
  });

  it.each(COUNTS)("a scene of %i draws exactly that many nodes, each once", (n) => {
    const sc = synthetic(n);
    expect(sc.count).toBe(n);
    expect(sc.nodes).toHaveLength(n);
    expect(new Set(sc.nodes.map((x) => x.id)).size).toBe(n);
  });

  it("mixes every type in Ring 1 and Ring 2, with an Overflow Node per type", () => {
    const sc = synthetic(100);
    for (const role of ["ring1", "ring2", "overflow"])
      expect(new Set(sc.nodes.filter((x) => x.role === role).map((x) => x.type))).toEqual(new Set(TYPES));
  });

  it("is trimmed by the real node limit rule: only Ring 2 is hidden", () => {
    // 100 nodes: K = 4 gives 1 Focus, 24 Ring 1, 6 Overflow, and 72 Ring 2, so 103 wanted.
    const sc = synthetic(100);
    expect([sc.demand, sc.hidden, sc.trimmed.ring2]).toEqual([103, 3, 3]);
    expect(sc.nodes.filter((x) => x.role === "ring1")).toHaveLength(24);
  });
});
