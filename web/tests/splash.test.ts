import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { typeColour } from "../src/colours";
import { ICON } from "../src/splash";

// The site icon is a static file; the splash draws the same graph from ICON, in the graph's type
// colours.
const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");

// The colour of one pixel of a PNG in web/public, as CSS. Enough of a decoder for the icons that
// web/icons.ts writes: 8 bit RGB or RGBA, not interlaced, with any of the five row filters.
function pixel(file: string, x: number, y: number): string {
  const png = readFileSync(new URL(`../public/${file}`, import.meta.url));
  const width = png.readUInt32BE(16);
  const [depth, colour, interlace] = [png[24], png[25], png[28]];
  expect([depth, interlace, [2, 6].includes(colour)], file).toEqual([8, 0, true]);
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length; at += png.readUInt32BE(at) + 12)
    if (png.toString("latin1", at + 4, at + 8) === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + png.readUInt32BE(at)));
  const data = inflateSync(Buffer.concat(chunks));
  const bpp = colour === 6 ? 4 : 3;
  const stride = width * bpp;
  let prev = Buffer.alloc(stride);
  for (let row = 0; row <= y; row++) {
    const line = Buffer.from(data.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)));
    const filter = data[row * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const [a, b, c] = [i >= bpp ? line[i - bpp] : 0, prev[i], i >= bpp ? prev[i - bpp] : 0];
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      line[i] += [0, a, b, (a + b) >> 1, paeth][filter];
    }
    prev = line;
  }
  return `#${[...prev.subarray(x * bpp, x * bpp + 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

describe("the splash's graphic", () => {
  it("is the site icon's graph, in the graph's type colours", () => {
    const discs = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="\d+" fill="(#\w+)"\/>/g)].map((m) => [Number(m[1]), Number(m[2]), m[3]]);
    const [fx, fy, ft] = ICON.focus;
    expect(discs).toEqual([...ICON.neighbours.map(([x, y, t]) => [x, y, typeColour(t)]), [fx, fy, typeColour(ft)]]);
    expect(svg).toContain(`d="${ICON.neighbours.map(([x, y]) => `M${fx} ${fy}L${x} ${y}`).join("")}"`);
  });

  it("has the Event disc at the centre and the Person disc in the ring, as the owner drew it (#106)", () => {
    expect(ICON.focus).toEqual([32, 32, "event"]);
    expect(ICON.neighbours).toContainEqual([51, 25.8, "person"]);
  });

  // The PNG icons are rendered from icon.svg by web/icons.ts (docs/runbook.md); a pixel at the
  // centre and one in the Person disc, scaled from the 64 x 64 box, show they were rendered again.
  it.each([
    ["icon.png", 32],
    ["apple-touch-icon.png", 180],
  ])("%s shows the same arrangement", (file, size) => {
    const at = (v: number) => Math.floor((v * size) / 64);
    expect(pixel(file, at(32), at(32))).toBe(typeColour("event"));
    expect(pixel(file, at(51), at(25.8))).toBe(typeColour("person"));
  });
});
