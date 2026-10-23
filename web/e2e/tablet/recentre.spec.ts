import { expect, test } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "../scene";
import { drag } from "../touch";
import { backTo, bare, offCentre, pinchOut, recentreInReach } from "../recentre";

// A tablet has the Recentre button too, large enough to tap (decision 188).
test.use({ reducedMotion: "reduce" });

test("Recentre undoes a drag and a pinch", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const start = await nodes(page);
  const button = await recentreInReach(page, 40);
  const from = (await bare(page))!;
  await drag(page, from, { x: from.x + 60, y: from.y + 40 });
  await expect.poll(() => offCentre(page)).toBeGreaterThan(20);
  await button.tap();
  await backTo(page, start);
  await pinchOut(page);
  await expect.poll(() => offCentre(page)).toBeGreaterThan(5);
  await button.tap();
  await backTo(page, start);
});
