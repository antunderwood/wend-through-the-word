import { expect, test } from "@playwright/test";
import { focusIs, nodes } from "../scene";
import { selectedIs, touchSpecs } from "../touch-input";

touchSpecs();

test("a name crowded out shows once its node is tapped (decision 124)", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616&pins=person:abraham_58");
  await focusIs(page, "person:isaac_616");
  // A node whose name is hidden and whose disc lies in the scene, where a finger can reach it.
  const at = Object.fromEntries((await nodes(page)).map((n) => [n.id, n]));
  const hidden = await page.evaluate((at) => {
    const stage = document.querySelector('[role="application"]')!;
    for (const e of document.querySelectorAll<HTMLElement>(".labels .nl.crowded")) {
      const n = at[e.dataset.node!];
      if (n && stage.contains(document.elementFromPoint(n.x, n.y))) return n.id;
    }
  }, at);
  expect(hidden).toBeTruthy();
  const name = page.locator(`.labels .nl[data-node="${hidden}"]`);
  await expect(name).toBeHidden();
  await page.touchscreen.tap(at[hidden!].x, at[hidden!].y);
  await selectedIs(page, hidden!);
  await expect(name).toBeVisible();
});
