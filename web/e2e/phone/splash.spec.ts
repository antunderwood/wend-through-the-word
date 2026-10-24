import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";
import { firstVisit, fits, splash, start, takeTour } from "../splash";
import { STEPS } from "../../src/tour";

// The splash on the owner's phone (#98), upright and on its side: whole in the window with nothing
// to scroll and both buttons large enough to tap, over a sheet that takes no tap until it closes.
const JESUS = "person:jesus_905";

test.use({ reducedMotion: "reduce" });

for (const size of [
  { width: 325, height: 600 },
  { width: 760, height: 330 },
]) {
  test(`${size.width} x ${size.height}: the splash fits, and a tap on Start exploring shows the app`, async ({ page }) => {
    await page.setViewportSize(size);
    await firstVisit(page);
    await page.goto("/");
    await expect(takeTour(page)).toBeVisible();
    await fits(page);
    await focusIs(page, JESUS);
    await start(page).tap();
    await expect(splash(page)).toBeHidden();
    await expect(page.getByRole("application")).toBeFocused();
    await expect(page.getByText("A tap selects a node")).toBeVisible();
  });
}

test("Welcome at the end of the Details tab shows the splash again, and Take the tour starts the tour", async ({ page }) => {
  await page.setViewportSize({ width: 325, height: 600 });
  await page.goto("/");
  await focusIs(page, JESUS);
  const details = page.getByRole("region", { name: "Sheet" }).getByRole("tabpanel", { name: "Details" });
  await details.getByRole("button", { name: "Welcome" }).tap();
  await expect(splash(page)).toBeVisible();
  await expect(start(page)).toBeFocused();
  await takeTour(page).tap();
  await expect(splash(page)).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Tour" })).toContainText(`Step 1 of ${STEPS.length}`);
});
