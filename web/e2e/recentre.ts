import { expect, type Page } from "@playwright/test";
import { nodes, type OnScreen } from "./scene";
import { pinch } from "./touch";

// The view follows the sheet, and a Recentre button frames the Focus again (decision 188), for the
// phone, tablet, and desktop specs.

// How far, in px, the Focus's disc is from the centre of the free scene: the scene less what the
// phone's sheet covers, below it or, at the side, right of it.
export const offCentre = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector('[data-tour="scene"]')!.getBoundingClientRect(),
      sheet = document.querySelector('[data-tour="sheet"]')?.getBoundingClientRect(),
      side = document.documentElement.hasAttribute("data-side");
    const right = sheet && side ? sheet.left : s.right,
      bottom = sheet && !side ? sheet.top : s.bottom;
    const f = window.wendGraph!.testNodes().find((n) => n.role === "focus")!;
    return Math.round(Math.hypot(f.x - (s.left + right) / 2, f.y - (s.top + bottom) / 2));
  });
// Waits for a frame that draws the Focus within a few px of the free scene's centre.
export const centred = (page: Page) => expect.poll(() => offCentre(page)).toBeLessThanOrEqual(3);

// A point of the bare scene a drag or a pinch can start on: the canvas, with no name or panel over
// it or 20 px round it, at least above px below the scene's top.
export const bare = (page: Page, above = 20) =>
  page.evaluate((above) => {
    const s = document.querySelector('[data-tour="scene"]')!.getBoundingClientRect(),
      free = (x: number, y: number) => [-20, 0, 20].every((d) => document.elementFromPoint(x + d, y + d)?.matches('[data-tour="scene"] canvas'));
    for (let y = s.top + above; y < s.bottom - 20; y += 10) for (let x = s.left + 20; x < s.right - 20; x += 10) if (free(x, y)) return { x, y };
    return null;
  }, above);
// A pinch out from a bare point of the scene, its second finger moving up from 20 to 110 px above the first.
export async function pinchOut(page: Page) {
  const from = await bare(page, 130);
  expect(from).not.toBeNull();
  await pinch(page, from!, 20, 110);
}

// Waits for the drawn scene to be where it was: every node within 2 px of its place in before.
export const backTo = (page: Page, before: OnScreen[]) =>
  expect
    .poll(async () => {
      const now = new Map((await nodes(page)).map((n) => [n.id, n]));
      return before.filter((n) => Math.hypot(now.get(n.id)!.x - n.x, now.get(n.id)!.y - n.y) > 2).map((n) => n.id);
    })
    .toEqual([]);

// The Recentre button: on screen, at least size px square, and nothing over its round face (its
// middle and four points 4 px in from its rim).
export async function recentreInReach(page: Page, size: number) {
  const button = page.getByRole("button", { name: "Recentre", exact: true });
  await expect(button).toBeInViewport({ ratio: 1 });
  const b = (await button.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(size);
  expect(b.height).toBeGreaterThanOrEqual(size);
  const over = await button.evaluate(
    (e, { x, y, width, height }) =>
      [
        [x + 4, y + height / 2],
        [x + width - 4, y + height / 2],
        [x + width / 2, y + 4],
        [x + width / 2, y + height - 4],
        [x + width / 2, y + height / 2],
      ]
        .map(([px, py]) => document.elementFromPoint(px, py))
        .filter((hit) => !e.contains(hit))
        .map((hit) => hit?.outerHTML.slice(0, 80)),
    b,
  );
  expect(over).toEqual([]);
  return button;
}
