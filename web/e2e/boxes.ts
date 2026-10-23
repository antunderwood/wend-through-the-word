import type { Locator, Page } from "@playwright/test";

// Boxes on the page, for the layout specs: what lies where, and what lies over what.
export type Box = { name: string; x: number; y: number; width: number; height: number };
export const box = async (name: string, l: Locator): Promise<Box> => ({ name, ...(await l.boundingBox())! });
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// Every pair of boxes that overlap, by their names.
export const overlaps = (boxes: Box[]) => boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.name} and ${b.name}`));

// The points of a rectangle, 12 px apart, where something other than the scene lies on top: none
// when the scene has the whole rectangle to itself. Names in the scene are the scene's own.
export const covered = (page: Page, r: { x: number; y: number; width: number; height: number }) =>
  page.evaluate(({ x, y, width, height }) => {
    const scene = document.querySelector('[role="application"]')!,
      found: string[] = [];
    for (let py = Math.ceil(y) + 2; py < y + height - 2; py += 12)
      for (let px = Math.ceil(x) + 2; px < x + width - 2; px += 12) {
        const e = document.elementFromPoint(px, py);
        if (!e || !scene.contains(e)) found.push(`${px},${py}: ${e?.tagName ?? "nothing"} ${e?.getAttribute("aria-label") ?? e?.className ?? ""}`);
      }
    return found.slice(0, 8);
  }, r);
