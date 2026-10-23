import { expect, test, type Page } from "@playwright/test";
import { box, covered, overlaps } from "../boxes";
import { focusIs, openOnAbraham } from "../scene";

// A phone upright (decision 183): one slim top bar, Your Path and the search icon; the view picker,
// Filters, and Copy link a row at the top of the Details tab; a notice that shows briefly and fades;
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

    test("the view picker, Filters, and Copy link are one row at the top of the Details tab, each large enough to tap", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      const controls = [
        details(page).getByRole("radio", { name: "Tilted plane" }),
        details(page).getByRole("radio", { name: "Free orbit" }),
        details(page).getByRole("button", { name: "Filters" }),
        details(page).getByRole("button", { name: "Copy link" }),
      ];
      const boxes = await Promise.all(controls.map((c, i) => box(`control ${i}`, c)));
      const name = (await details(page).getByRole("heading", { level: 2 }).boundingBox())!;
      const tab = (await details(page).boundingBox())!;
      expect(overlaps(boxes)).toEqual([]);
      for (const b of boxes) {
        expect(b.height, b.name).toBeGreaterThanOrEqual(44);
        expect(b.y + b.height / 2, b.name).toBeCloseTo(boxes[0].y + boxes[0].height / 2, 0); // one row
        expect(b.y + b.height, b.name).toBeLessThanOrEqual(name.y); // above the Selected Node
        expect(b.x, b.name).toBeGreaterThanOrEqual(tab.x);
        expect(b.x + b.width, b.name).toBeLessThanOrEqual(tab.x + tab.width);
      }
    });

    test("a notice shows above the sheet, clear of the hint, then fades", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      await details(page).getByRole("button", { name: "Copy link" }).tap();
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
  await expect(page.getByText("A tap selects a node.")).toContainText("A tap selects a node. A double tap, Make Focus, or search moves the Focus.");
});
