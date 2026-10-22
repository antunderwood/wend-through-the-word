import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, type OnScreen } from "./scene";
import { doubleTap, drag, pageMoved, pinch } from "./touch";

// The touch specs both touch projects run (e2e/phone and e2e/tablet): a tap selects, a double tap
// makes the Focus, a drag moves the camera, and a pinch zooms, and the page itself never moves.
export const ABRAHAM = "person:abraham_58";
const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export const node = async (page: Page, id: string) => (await nodes(page)).find((n) => n.id === id)!;
// The Selected Node, as the scene marks it: its name is underlined.
export const selectedIs = (page: Page, id: string) => expect(page.locator(".labels .nl.selected")).toHaveAttribute("data-node", id);
// The scene's box on the page.
export const sceneBox = async (page: Page) => (await page.getByRole("application").boundingBox())!;

// The Ring 1 node a finger can tap with least doubt: its disc lies in the scene, and it is the one
// farthest from any other drawn node.
export async function tappable(page: Page): Promise<OnScreen> {
  const all = await nodes(page),
    box = await sceneBox(page);
  const inside = (n: OnScreen) => n.x > box.x + 4 && n.x < box.x + box.width - 4 && n.y > box.y + 4 && n.y < box.y + box.height - 4;
  const room = (n: OnScreen) => Math.min(...all.filter((m) => m !== n).map((m) => far(m, n)));
  const ring1 = all.filter((n) => n.role === "ring1" && inside(n)).sort((a, b) => room(b) - room(a));
  expect(ring1.length).toBeGreaterThan(0);
  return ring1[0];
}

export function touchSpecs() {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await focusIs(page, ABRAHAM);
  });

  test("a tap on a node selects it and leaves the scene", async ({ page }) => {
    const target = await tappable(page);
    const before = await nodes(page);
    await page.touchscreen.tap(target.x, target.y);
    await selectedIs(page, target.id);
    expect(await nodes(page)).toEqual(before);
  });

  test("a double tap on a node makes it the Focus", async ({ page }) => {
    const target = await tappable(page);
    await doubleTap(page, target);
    await focusIs(page, target.id);
  });

  test("a drag moves the camera, even from a node, and selects nothing; the page stays put", async ({ page }) => {
    const target = await tappable(page),
      box = await sceneBox(page);
    const abraham = await node(page, ABRAHAM);
    await drag(page, target, { x: target.x, y: Math.min(target.y + 80, box.y + box.height - 10) });
    await expect.poll(async () => far(await node(page, ABRAHAM), abraham)).toBeGreaterThan(20);
    await selectedIs(page, ABRAHAM);
    expect(await pageMoved(page)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  test("a pinch zooms the camera, not the page, even with a finger on a name", async ({ page }) => {
    const target = await tappable(page);
    const spread = async () => far(await node(page, ABRAHAM), await node(page, target.id));
    const before = await spread();
    // One finger rests on the Focus's name, inside the scene: a name is not the canvas, and the
    // page must not zoom from it. The other moves away above it.
    const name = (await page.locator(".labels .nl.focus").boundingBox())!,
      box = await sceneBox(page);
    const anchor = { x: (Math.max(name.x, box.x) + Math.min(name.x + name.width, box.x + box.width)) / 2, y: name.y + 8 };
    await pinch(page, anchor, 40, 240);
    await expect.poll(spread).toBeGreaterThan(before * 1.2);
    expect(await pageMoved(page)).toEqual({ scale: 1, x: 0, y: 0 });
  });
}
