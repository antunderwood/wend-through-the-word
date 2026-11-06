import { expect, test } from "@playwright/test";
import { focusIs, nodes } from "../scene";
import { selectedIs, touchSpecs } from "../touch-input";

touchSpecs();

test("a name crowded out shows once its node is tapped (decision 124)", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616&pins=person:abraham_58");
  await focusIs(page, "person:isaac_616");
  // The sheet's peek height is measured after the first frame, and the camera eases to the space above
  // it: the nodes are read once they stay put.
  let last = "";
  await expect.poll(async () => last === (last = JSON.stringify(await nodes(page)))).toBe(true);
  // A node whose name is hidden and whose disc lies in the scene, where a finger can reach it, with
  // no other node's disc or name under the finger.
  const at = Object.fromEntries((await nodes(page)).map((n) => [n.id, n]));
  const hidden = await page.evaluate((at) => {
    const stage = document.querySelector('[role="application"]')!;
    const alone = (n: { id: string; x: number; y: number }) => Object.values(at).every((o) => o.id === n.id || Math.hypot(o.x - n.x, o.y - n.y) > 14);
    for (const e of document.querySelectorAll<HTMLElement>(".labels .nl.crowded")) {
      const n = at[e.dataset.node!];
      const hit = n && document.elementFromPoint(n.x, n.y);
      if (n && alone(n) && hit && stage.contains(hit) && !hit.closest(`.nl:not([data-node="${n.id}"])`)) return n.id;
    }
  }, at);
  expect(hidden).toBeTruthy();
  const name = page.locator(`.labels .nl[data-node="${hidden}"]`);
  await expect(name).toBeHidden();
  await page.touchscreen.tap(at[hidden!].x, at[hidden!].y);
  await selectedIs(page, hidden!);
  await expect(name).toBeVisible();
});
