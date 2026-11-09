import { expect, test, type Page } from "@playwright/test";
import { openSheet, openView } from "../touch";
import { box, covered, overlaps } from "../boxes";
import { focusIs, openOnAbraham } from "../scene";

// A phone upright (decision 183): one slim top bar, Your Path and the search icon; the view picker,
// Filters, Key, and Copy link in the View popover beside Recentre (decision 236); a notice that shows briefly and fades;
// and the scene has everything between the bar and the sheet, open or closed to its handle.
const ABRAHAM = "person:abraham_58";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
const notice = (page: Page) => page.getByRole("status");

test.use({ reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });

// The owner's Android phone (CSS 325 px wide) and the phone project's own size.
for (const size of [{ width: 325, height: 700 }]) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("the top bar is one slim row of Your Path and the search icon", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      const path = await box("Your Path", bar(page)),
        search = await box("Search", page.getByRole("button", { name: "Search" }));
      expect(overlaps([path, search])).toEqual([]);
      for (const b of [path, search]) {
        expect(b.y, b.name).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, b.name).toBeLessThanOrEqual(44);
        expect(b.x + b.width, b.name).toBeLessThanOrEqual(size.width);
      }
      // The icon is still large enough to tap.
      expect(search.width).toBeGreaterThanOrEqual(40);
      expect(search.height).toBeGreaterThanOrEqual(40);
    });

    test("the scene has everything between the top bar and the sheet, open or closed", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      const top = (await bar(page).boundingBox())!;
      const below = top.y + top.height;
      for (const open of [true, false]) {
        if (!open) await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
        const handle = (await sheet(page).getByRole("button", { name: /the sheet$/ }).boundingBox())!;
        // Nothing lies over the scene from the bar down to the sheet's handle.
        expect(await covered(page, { x: 0, y: below, width: size.width, height: handle.y - below })).toEqual([]);
        expect((await page.getByRole("application").boundingBox())!.y).toBeLessThanOrEqual(below);
      }
    });

    test("the View button sits beside Recentre, clear of the top bar and the hint, and its popover holds the view picker, Filters, Key, and Copy link, each large enough to tap", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      const recentre = await box("Recentre", page.getByRole("button", { name: "Recentre", exact: true })),
        view = await box("View", page.getByRole("button", { name: "View", exact: true }));
      const boxes = [await box("Your Path", bar(page)), await box("Search", page.getByRole("button", { name: "Search" })), recentre, view];
      expect(overlaps(boxes)).toEqual([]);
      expect(view.y).toBeCloseTo(recentre.y, 0); // one row
      expect(view.x).toBeGreaterThanOrEqual(recentre.x + recentre.width);
      expect(view.height).toBeGreaterThanOrEqual(44);
      expect(view.width).toBeGreaterThanOrEqual(44);
      // The Details tab starts on the node: the actions, no row of scene settings.
      await openSheet(page);
      await expect(details(page).getByRole("radio")).toHaveCount(0);
      await expect(details(page).getByRole("button", { name: "Copy link" })).toHaveCount(0);

      const menu = await openView(page);
      const controls = [
        menu.getByRole("radio", { name: "Tilted plane" }),
        menu.getByRole("radio", { name: "Free orbit" }),
        menu.locator("label", { hasText: "Themes" }),
        menu.getByRole("button", { name: "Copy link" }),
      ];
      const tapped = await Promise.all(controls.map((c, i) => box(`control ${i}`, c)));
      const m = await box("menu", menu);
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.width).toBeLessThanOrEqual(size.width);
      expect(m.y).toBeGreaterThanOrEqual(view.y + view.height); // drops from under the buttons
      expect(m.y + m.height).toBeLessThanOrEqual(size.height);
      for (const b of tapped) {
        expect(b.x, b.name).toBeGreaterThanOrEqual(m.x);
        expect(b.x + b.width, b.name).toBeLessThanOrEqual(m.x + m.width);
      }
      for (const b of tapped) expect(b.height, b.name).toBeGreaterThanOrEqual(44);
      // The Key is in the popover; it scrolls when the screen is short.
      await menu.getByRole("group", { name: "Key" }).scrollIntoViewIfNeeded();
      await expect(menu.getByRole("group", { name: "Key" })).toBeInViewport();
    });

    test("a notice shows above the sheet, clear of the hint, then fades", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      await (await openView(page)).getByRole("button", { name: "Copy link" }).tap();
      await expect(notice(page)).toHaveText("Link copied.");
      await expect(notice(page)).toHaveCSS("opacity", "1");
      const boxes = [
        await box("Your Path", bar(page)),
        await box("Search", page.getByRole("button", { name: "Search" })),
        await box("hint", page.getByText("A tap selects a node.")),
        await box("notice", notice(page)),
        await box("sheet", sheet(page)),
      ];
      expect(overlaps(boxes)).toEqual([]);
      for (const b of boxes) {
        expect(b.x, b.name).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, b.name).toBeLessThanOrEqual(size.width);
      }
      expect((await page.getByRole("button", { name: "Dismiss hint" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Faded after a few seconds; the words stay for a screen reader.
      await expect(notice(page)).toHaveCSS("opacity", "0", { timeout: 6000 });
      await expect(notice(page)).toHaveText("Link copied.");
    });
  });
}

test("on a phone the tour, the credits, and the data version are at the end of the Details tab", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await openSheet(page);
  const credits = details(page).getByRole("link", { name: "About and credits" });
  await credits.scrollIntoViewIfNeeded();
  await expect(credits).toBeInViewport();
  expect((await credits.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(details(page)).toContainText("Data: CC BY-SA 4.0. Data version");
  await details(page).getByRole("button", { name: "Help: take the tour" }).tap();
  await expect(page.getByRole("dialog", { name: /tour/i })).toBeVisible();
});

test("on a touch screen the first-use hint says tap and double tap", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await expect(page.getByText("A tap selects a node.")).toContainText("A tap selects a node. A double tap makes it the Focus.");
});
