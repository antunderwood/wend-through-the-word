import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { typeColour } from "../src/colours";
import { ICON } from "../src/splash";

// The site icon is a static file; the splash draws the same graph from ICON, in the graph's type
// colours.
const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");

describe("the splash's graphic", () => {
  it("is the site icon's graph, in the graph's type colours", () => {
    const discs = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="\d+" fill="(#\w+)"\/>/g)].map((m) => [Number(m[1]), Number(m[2]), m[3]]);
    const [fx, fy, ft] = ICON.focus;
    expect(discs).toEqual([...ICON.neighbours.map(([x, y, t]) => [x, y, typeColour(t)]), [fx, fy, typeColour(ft)]]);
    expect(svg).toContain(`d="${ICON.neighbours.map(([x, y]) => `M${fx} ${fy}L${x} ${y}`).join("")}"`);
  });
});
