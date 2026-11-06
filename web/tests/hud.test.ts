import { describe, expect, it } from "vitest";
import { chamfer, clipPath, linkCounts, segments, shortList } from "../src/hud";
import type { Link } from "../src/model";

const link = (id: string, type: Link["type"]): Link => ({ id, type, weight: 1, edges: [] });

describe("the HUD", () => {
  it("cuts the top left and bottom right corners", () => {
    expect(chamfer(100, 60, 10)).toEqual([
      [10, 0],
      [100, 0],
      [100, 50],
      [90, 60],
      [0, 60],
      [0, 10],
    ]);
    expect(clipPath(chamfer(100, 60, 10)).startsWith("polygon(10px 0px, 100px 0px")).toBe(true);
  });

  it("never cuts more than half the box", () => {
    expect(chamfer(20, 10, 18)[0]).toEqual([5, 0]);
    expect(chamfer(0, 0, 18).every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it("counts links by type in the panel's order, leaving out empty types", () => {
    const links = [link("01001001", "verse"), link("person:a", "person"), link("place:b", "place"), link("person:c", "person")];
    expect(linkCounts(links)).toEqual([
      { type: "person", count: 2 },
      { type: "place", count: 1 },
      { type: "verse", count: 1 },
    ]);
  });

  it("lights at least one segment for any count and all for the largest", () => {
    expect(segments(0, 10)).toBe(0);
    expect(segments(1, 1000)).toBe(1);
    expect(segments(66, 66, 12)).toBe(12);
    expect(segments(33, 66, 12)).toBe(6);
  });

  it("shortens a long list of names, once each", () => {
    expect(shortList("Lord, LORD, Father")).toBe("Lord, LORD, Father");
    expect(shortList("a, b, c, d, e, f, a", 4)).toBe("a, b, c, d +2");
  });
});
