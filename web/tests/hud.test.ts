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

import { clampPlace } from "../src/hud";
describe("the HUD's place", () => {
  it("stays whole on the screen", () => {
    expect(clampPlace({ x: -50, y: -10, w: 340 }, 1280, 720)).toEqual({ x: 8, y: 8, w: 340 });
    expect(clampPlace({ x: 2000, y: 900, w: 340, h: 400 }, 1280, 720)).toEqual({ x: 932, y: 312, w: 340, h: 400 });
  });
  it("keeps its size between the least and the most", () => {
    expect(clampPlace({ x: 100, y: 100, w: 100, h: 50 }, 1280, 720)).toEqual({ x: 100, y: 100, w: 280, h: 220 });
    expect(clampPlace({ x: 0, y: 0, w: 5000, h: 5000 }, 1280, 720)).toEqual({ x: 8, y: 8, w: 720, h: 704 });
  });
});

import { clearance, leadRoute } from "../src/hud";
describe("the HUD's leader line", () => {
  const card = { left: 1000, right: 1340, top: 72, bottom: 600 };
  it("goes to the nearer side of the card, and not at all from under it", () => {
    expect(leadRoute({ x: 400, y: 300, r: 8 }, card)![0]).toEqual([408, 300]);
    expect(leadRoute({ x: 400, y: 300, r: 8 }, card)!.at(-1)).toEqual([1000, 300]);
    expect(leadRoute({ x: 1400, y: 300, r: 8 }, card)!.at(-1)).toEqual([1340, 300]);
    expect(leadRoute({ x: 1100, y: 300, r: 8 }, card)).toBeNull();
  });
  it("keeps clear of the Focus that lies across its straight way", () => {
    const focus = { x: 700, y: 300, r: 30 };
    const route = leadRoute({ x: 400, y: 300, r: 8 }, card, focus)!;
    expect(clearance(route, focus)).toBeGreaterThanOrEqual(18);
    expect(route.at(-1)![0]).toBe(1000);
  });
  it("takes the plain route when the Focus is out of the way", () => {
    const route = leadRoute({ x: 400, y: 300, r: 8 }, card, { x: 700, y: 700, r: 30 })!;
    expect(route.every(([, y]) => y === 300)).toBe(true);
  });
});
