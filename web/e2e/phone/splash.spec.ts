import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";
import { firstVisit, fits, splash, start } from "../splash";

// The splash on the owner's phone (#98), upright and on its side: whole in the window with nothing
// to scroll and buttons large enough to tap, over a sheet that takes no tap until it closes.
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
    await expect(splash(page)).toBeVisible();
    await fits(page);
    await focusIs(page, JESUS);
    await start(page).tap();
    await expect(splash(page)).toBeHidden();
    await expect(page.getByRole("application")).toBeFocused();
    await expect(page.getByText("A tap selects a node")).toBeVisible();
  });
}
