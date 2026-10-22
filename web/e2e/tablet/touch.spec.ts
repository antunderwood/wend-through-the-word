import { expect, test } from "@playwright/test";
import { drag } from "../touch";
import { node, selectedIs, touchSpecs } from "../touch-input";

touchSpecs();

// A tablet keeps the desktop layout; a tap shows what a mouse shows on hover (decision 124).
const SARAH = "person:sarah_2473",
  REBEKAH = "person:rebekah_2401";

test("a tapped node's name and Relationship words show, with the desktop panel", async ({ page }) => {
  const words = page.locator(".labels .el:visible");
  await expect(words).toHaveCount(0);
  const sarah = await node(page, SARAH);
  await page.touchscreen.tap(sarah.x, sarah.y);
  await selectedIs(page, SARAH);
  await expect(page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await expect(page.locator(`.labels .nl[data-node="${SARAH}"]`)).toBeVisible();
  // Fixture: Abraham SPOUSE_OF Sarah (Female).
  await expect(words).toHaveText(["wife"]);
});

test("a tapped Ring 2 node names itself and its way to the Focus, until a drag or a tap elsewhere", async ({ page }) => {
  const tip = page.getByRole("tooltip");
  const rebekah = await node(page, REBEKAH);
  expect(rebekah.role).toBe("ring2");
  await page.touchscreen.tap(rebekah.x, rebekah.y);
  // Fixture: Rebekah is Isaac's first Ring 2 neighbour.
  await expect(tip).toHaveText("Rebekah → Isaac → Abraham");
  await drag(page, { x: rebekah.x, y: rebekah.y + 40 }, { x: rebekah.x, y: rebekah.y + 120 });
  await expect(tip).toBeHidden();

  const moved = await node(page, REBEKAH);
  await page.touchscreen.tap(moved.x, moved.y);
  await expect(tip).toHaveText("Rebekah → Isaac → Abraham");
  const box = (await page.getByRole("application").boundingBox())!;
  await page.touchscreen.tap(box.x + 10, box.y + box.height - 10);
  await expect(tip).toBeHidden();
});
