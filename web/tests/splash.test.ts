import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { typeColour } from "../src/colours";
import { ICON } from "../src/splash";

// The site icon is a static file; the splash draws the same graph from ICON, in the graph's type
// colours.
const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");

// The PNG row filter's Paeth predictor: of the bytes to the left (a), above (b) and above left (c),
// the one nearest to a + b - c, preferring a, then b.
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// One pixel of a PNG in web/public: its colour as CSS, and its alpha (255 in an RGB PNG). Enough of a
// decoder for the icons that web/icons.ts writes: 8 bit RGB or RGBA, not interlaced, with any of the
// five row filters.
function pixel(file: string, x: number, y: number): { colour: string; alpha: number } {
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
      line[i] += [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
    }
    prev = line;
  }
  const [r, g, b, alpha = 255] = prev.subarray(x * bpp, (x + 1) * bpp);
  return { colour: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`, alpha };
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
  // Focus and one in the Person disc, scaled from ICON's 64 x 64 box, show they were rendered again.
  it.each([
    ["icon.png", 32],
    ["apple-touch-icon.png", 180],
  ])("%s shows the same arrangement", (file, size) => {
    const at = (v: number) => Math.floor((v * size) / 64);
    const [fx, fy, ft] = ICON.focus;
    const [px, py] = ICON.neighbours.find(([, , t]) => t === "person")!;
    expect(pixel(file, at(fx), at(fy)).colour).toBe(typeColour(ft));
    expect(pixel(file, at(px), at(py)).colour).toBe(typeColour("person"));
  });

  // web/icons.ts drops the SVG's rx="14" for the 180 px icon, as iOS rounds the corners itself, and
  // keeps it for the 32 px icon, which is transparent outside its rounded corners.
  it("apple-touch-icon.png has square corners and icon.png rounded ones", () => {
    expect(pixel("apple-touch-icon.png", 0, 0)).toEqual({ colour: "#0d0f17", alpha: 255 });
    expect(pixel("icon.png", 0, 0).alpha).toBe(0);
  });
});
