import { expect, test, type Page } from "@playwright/test";
import { box, covered, overlaps } from "../boxes";
import { focusIs, nodes, openOnAbraham } from "../scene";

// A phone on its side keeps the phone layout (decision 184): the sheet is a full-height side panel
// on the right, about 40% of the width, and the scene keeps the full height to its left, with its
// centre moved sideways into that space. Views A and C only, as on any phone.
const ABRAHAM = "person:abraham_58";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });
const heading = (page: Page) => details(page).getByRole("heading", { level: 2 });
const reader = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Reader" }).getByRole("region", { name: "Reader" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });

test.use({ reducedMotion: "reduce" });

// The Focus as drawn: its node, and its name, which nothing may lie over.
async function focusInView(page: Page, left: number) {
  const focus = (await nodes(page)).find((n) => n.role === "focus")!;
  const name = page.locator(".labels .nl.focus");
  await expect(name).toBeInViewport({ ratio: 1 });
  const b = (await name.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(left);
  expect(await name.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 })).toBe(true);
  return focus;
}
// Waits for a frame that draws the Focus in the middle of the space left of x.
const focusCentredLeftOf = (page: Page, x: number) =>
  expect.poll(async () => Math.abs((await nodes(page)).find((n) => n.role === "focus")!.x - x / 2)).toBeLessThan(2);

// Each of the Selected Node's actions is whole on screen and nothing lies over its middle.
async function actionsInReach(page: Page) {
  for (const name of ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"]) {
    const button = details(page).getByRole("button", { name, exact: true });
    await expect(button, name).toBeInViewport({ ratio: 1 });
    const b = (await button.boundingBox())!;
    expect(await button.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 }), name).toBe(true);
  }
}

// A phone on its side (844 x 390), and the owner's Android phone on its side (about 760 x 330).
for (const size of [
  { width: 844, height: 390 },
  { width: 760, height: 330 },
]) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("the sheet is a full-height side panel on the right, and the scene has the rest, with nothing over anything else", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      await expect(page.locator("html")).toHaveAttribute("data-phone");
      const s = await box("sheet", sheet(page));
      expect(s.y).toBeCloseTo(0, 0);
      expect(s.height).toBeCloseTo(size.height, 0);
      expect(s.x + s.width).toBeCloseTo(size.width, 0);
      expect(s.width).toBeGreaterThan(size.width * 0.35);
      expect(s.width).toBeLessThan(size.width * 0.45);

      // The slim top bar, the hint, and the sheet lie clear of each other, on screen.
      const boxes = [
        await box("Your Path", bar(page)),
        await box("Search", page.getByRole("button", { name: "Search" })),
        await box("hint", page.getByText("A tap selects a node.")),
        s,
      ];
      expect(overlaps(boxes)).toEqual([]);
      for (const b of boxes) {
        expect(b.x, b.name).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, b.name).toBeLessThanOrEqual(size.width + 1);
        expect(b.y + b.height, b.name).toBeLessThanOrEqual(size.height + 1);
      }
      expect(boxes[0].y + boxes[0].height).toBeLessThanOrEqual(44);

      // The Focus is in view, uncovered, in the middle of the space left of the sheet.
      await focusInView(page, s.x);
      await focusCentredLeftOf(page, s.x);
      await actionsInReach(page);
    });

    test("the scene has everything left of the sheet below the top bar, and all but the handle when the sheet is closed", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      const top = (await bar(page).boundingBox())!;
      const below = top.y + top.height;
      for (const open of [true, false]) {
        if (!open) await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
        const edge = open ? (await sheet(page).boundingBox())!.x : (await sheet(page).getByRole("button", { name: "Open the sheet" }).boundingBox())!.x;
        if (!open) expect(edge).toBeGreaterThan(size.width - 50);
        expect(await covered(page, { x: 0, y: below, width: edge, height: size.height - below })).toEqual([]);
        await focusCentredLeftOf(page, edge);
        await focusInView(page, edge);
      }
    });

    test("the tabs work: Read opens the Reader tab, and Details has the view picker with views A and C only", async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      await expect(details(page).getByRole("radiogroup", { name: "View" }).getByRole("radio")).toHaveText(["Tilted plane", "Free orbit"]);
      await details(page).getByRole("button", { name: "Read", exact: true }).tap();
      await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
      await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeInViewport();
      // At least four lines of the chapter show.
      expect((await reader(page).locator(".text").boundingBox())!.height).toBeGreaterThan(4 * 18 * 1.75);
      await sheet(page).getByRole("tab", { name: "Details" }).tap();
      await expect(heading(page)).toHaveText("Abraham");
      await actionsInReach(page);
      await details(page).getByRole("radio", { name: "Free orbit" }).tap();
      await expect(details(page).getByRole("radio", { name: "Free orbit" })).toBeChecked();
      await focusInView(page, (await sheet(page).boundingBox())!.x);
    });

    test("search opens over the scene, clear of the sheet, and fits the screen", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
      await openOnAbraham(page);
      await focusIs(page, ABRAHAM);
      await page.getByRole("button", { name: "Search" }).tap();
      await page.keyboard.type("Isaac");
      const results = page.getByRole("list", { name: "Search results" });
      await expect(results.getByRole("button").first()).toBeInViewport({ ratio: 1 });
      const found = await box("search", page.getByRole("search"));
      expect(overlaps([found, await box("sheet", sheet(page))])).toEqual([]);
      expect(found.y + found.height).toBeLessThanOrEqual(size.height);
      await results.getByRole("button").first().tap();
      await focusIs(page, "person:isaac_616");
    });
  });
}

test("turning the phone keeps the state: the Focus, the selection, the tab, and the sheet open or closed", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await details(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).tap();
  await expect(heading(page)).toHaveText("Sarah");

  // On its side: the same selection in the side panel.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await sheet(page).boundingBox())!.y).toBeLessThan(1);
  await focusIs(page, ABRAHAM);
  await expect(heading(page)).toHaveText("Sarah");
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  // The Reader tab, then the sheet closed.
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();

  // Upright again: the sheet is still closed, at the bottom, on the Reader tab, with Sarah selected.
  await page.setViewportSize({ width: 390, height: 844 });
  const handle = sheet(page).getByRole("button", { name: "Open the sheet" });
  await expect(handle).toBeInViewport({ ratio: 1 });
  expect((await handle.boundingBox())!.y).toBeGreaterThan(844 - 50);
  await handle.tap();
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  await sheet(page).getByRole("tab", { name: "Details" }).tap();
  await expect(heading(page)).toHaveText("Sarah");
  await focusIs(page, ABRAHAM);
});
