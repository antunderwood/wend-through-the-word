import { expect, test } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "../scene";

// The hidden-nodes note on a phone (story 30, decision 33): one node limit everywhere (decision 177),
// so the fixture's scenes are never trimmed; the test sets a low limit through the Focus Model's
// own filter action.
const ABRAHAM = "person:abraham_58";

test.use({ reducedMotion: "reduce" });

test("the hidden-nodes note says how many nodes the limit trimmed, in the column above the sheet", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  const note = page.getByText(/hidden to keep the view fast$/);
  await expect(note).toHaveCount(0);
  const before = (await nodes(page)).length;

  await page.evaluate(() => window.wendApply!({ type: "setFilter", key: "nodeLimit", value: 40 }));
  await expect.poll(async () => (await nodes(page)).length).toBe(40);
  await expect(note).toHaveText(`${before - 40} nodes hidden to keep the view fast`);

  // On screen, above the sheet, and nothing lies over it.
  await expect(note).toBeInViewport({ ratio: 1 });
  const b = (await note.boundingBox())!,
    sheet = (await page.getByRole("region", { name: "Sheet" }).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(sheet.y);
  expect(await note.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 })).toBe(true);
});
