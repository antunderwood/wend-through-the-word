import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "../scene";
import { openSheet } from "../touch";

const ABRAHAM = "person:abraham_58";
const hud = (page: Page) => page.getByRole("region", { name: "Selected Node HUD" });
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });

test.use({ reducedMotion: "reduce" });

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
}

test("on a phone the HUD docks above the closed sheet in place of its peek, and the choice is kept", async ({ page }) => {
  await open(page);
  await expect(hud(page)).toHaveCount(0);
  // The HUD button is at the top right of the Details tab, beside the name.
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();

  // The sheet goes right away, tabs and handle too, and the HUD sits at the bottom, across the screen.
  await expect(page.locator(".sheet.away")).toHaveCount(1);
  await expect(sheet(page).getByRole("tablist", { name: "Sheet" })).toBeHidden();
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  const card = (await hud(page).boundingBox())!;
  expect(card.x).toBeCloseTo(8, 0);
  expect(card.width).toBeCloseTo(390 - 16, 0);
  expect(card.y + card.height).toBeCloseTo(844 - 8, 0);
  expect(card.height).toBeLessThanOrEqual(844 * 0.45);
  // It does not move or size on a phone.
  await expect(hud(page).getByRole("button", { name: "Move HUD" })).toHaveCount(0);
  await expect(hud(page).getByRole("button", { name: "Resize HUD" })).toHaveCount(0);

  // A node tapped in the scene shows on the HUD.
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.touchscreen.tap(isaac.x, isaac.y);
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");

  // Kept across a reload: the sheet stays closed, not peeking.
  await page.reload();
  await expect(hud(page)).toBeVisible();
  await expect(page.locator(".sheet.peek")).toHaveCount(0);

  // Details opens the sheet at half over it; closing the sheet brings the HUD back.
  await hud(page).getByRole("button", { name: "Details" }).tap();
  await expect(hud(page)).toHaveCount(0);
  await expect(page.locator(".sheet.peek, .sheet.collapsed, .sheet.away")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
  await expect(hud(page)).toBeVisible();
  // The sheet's HUD button is the other way across: open Details, press HUD.
  await hud(page).getByRole("button", { name: "Details" }).tap();
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();
  await expect(hud(page)).toBeVisible();
  await expect(page.locator(".sheet.away")).toHaveCount(1);
});

test("on a narrow, zoomed phone the HUD buttons stay on one row and the content pane keeps room", async ({ page }) => {
  // Browser zoom at 130 percent shrinks the CSS viewport; the text-size setting does much the same.
  await page.setViewportSize({ width: 300, height: 560 });
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await open(page);
  await expect(hud(page)).toBeVisible();
  await hud(page).getByRole("tab", { name: "Verses" }).tap();
  await page.screenshot({ path: process.env.HUD_ZOOM_SHOT ?? "test-results/hud-zoom.png" });
  const boxes = await hud(page).locator(".actions button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  for (const b of boxes) expect(Math.abs(b.y - boxes[0].y)).toBeLessThan(1);
  for (const b of boxes) expect(b.height).toBeLessThanOrEqual(32);
  const body = (await hud(page).locator(".body").boundingBox())!,
    card = (await hud(page).boundingBox())!;
  const tabH = (await hud(page).getByRole("tab", { name: "Verses" }).boundingBox())!.height;
  expect(tabH).toBeGreaterThanOrEqual(30);
  expect(body.height).toBeGreaterThan(card.height * 0.35);
});

test("on a phone on its side the sheet stays and the HUD is not offered", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await open(page);
  await expect(hud(page)).toHaveCount(0);
  await expect(sheet(page).getByRole("button", { name: "HUD", exact: true })).toHaveCount(0);
});

test("on a phone the HUD expands to nearly the whole screen and shrinks back, keeping its tab", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await open(page);
  const card = hud(page);
  await expect(card).toBeVisible();
  const docked = (await card.boundingBox())!;

  await card.getByRole("button", { name: "Expand HUD" }).tap();
  await expect(card.getByRole("button", { name: "Shrink HUD" })).toHaveAttribute("aria-expanded", "true");
  const big = (await card.boundingBox())!;
  expect(big.height).toBeGreaterThan(docked.height * 1.5);
  expect(big.height).toBeGreaterThan(844 * 0.6);
  // The card stays at the bottom edge and under the top bar.
  expect(big.y + big.height).toBeCloseTo(844 - 8, 0);
  expect(big.y).toBeGreaterThan(40);
  await page.screenshot({ path: process.env.HUD_EXPAND_SHOT ?? "test-results/hud-expanded.png" });

  // Switching tabs keeps it expanded.
  await card.getByRole("tab", { name: "Verses" }).tap();
  await expect(card.getByRole("tab", { name: "Verses" })).toHaveAttribute("aria-selected", "true");
  expect((await card.boundingBox())!.height).toBeCloseTo(big.height, 0);

  // Shrink goes back to the docked size, tab kept.
  await card.getByRole("button", { name: "Shrink HUD" }).tap();
  await expect(card.getByRole("button", { name: "Expand HUD" })).toBeVisible();
  expect((await card.boundingBox())!.height).toBeCloseTo(docked.height, 0);
  await expect(card.getByRole("tab", { name: "Verses" })).toHaveAttribute("aria-selected", "true");
});

test("on a phone the HUD minimises to a slim bar with the node's name, and restores with a tap", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await open(page);
  const card = hud(page);
  await expect(card).toBeVisible();
  const docked = (await card.boundingBox())!;

  await card.getByRole("button", { name: "Minimise HUD" }).tap();
  await expect(card.getByRole("button", { name: "Restore HUD" })).toBeVisible();
  // Only the bar: the type and the name, no tabs or actions.
  await expect(card).toContainText("Abraham");
  await expect(card.getByRole("tab")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Pin" })).toHaveCount(0);
  const bar = (await card.boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(56);
  expect(bar.height).toBeLessThan(docked.height / 3);
  // The Details and Reader tabs are gone; the bar spans the bottom and has its own Details switch.
  await expect(sheet(page).getByRole("tablist", { name: "Sheet" })).toBeHidden();
  expect(bar.width).toBeCloseTo(390 - 16, 0);
  expect(bar.y + bar.height).toBeCloseTo(844 - 8, 0);
  await expect(card.getByRole("button", { name: "Details" })).toBeVisible();
  // The selection and Focus stay where they were.
  await focusIs(page, ABRAHAM);
  await page.screenshot({ path: process.env.HUD_MIN_SHOT ?? "test-results/hud-minimised.png" });

  // Tapping the bar brings the HUD back at the docked size.
  await card.locator(".mini-name").tap();
  await expect(card.getByRole("button", { name: "Minimise HUD" })).toBeVisible();
  expect((await card.boundingBox())!.height).toBeCloseTo(docked.height, 0);

  // A node tapped while minimised changes the name on the bar.
  await card.getByRole("button", { name: "Minimise HUD" }).tap();
  // The camera eases to make room for the slim bar, so read where Isaac is on each try.
  await expect(async () => {
    const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
    await page.touchscreen.tap(isaac.x, isaac.y);
    await expect(card).toContainText("Isaac", { timeout: 1000 });
  }).toPass();
  await expect(card.getByRole("tab")).toHaveCount(0);
  await card.getByRole("button", { name: "Restore HUD" }).tap();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Isaac");
});

test("the phone HUD names the Selected Node's place on Your Path, and its arrows are 40 px to touch", async ({ page }) => {
  await open(page);
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();
  await expect(hud(page).getByText("Your Path 1 of 1")).toBeVisible();
  // Slim to look at, and the touch size reaches 40 px or more with the ::after.
  for (const name of ["Prev", "Next"]) {
    const button = hud(page).getByRole("button", { name, exact: true });
    const touch = await button.evaluate((e) => {
      const a = getComputedStyle(e, "::after");
      return { h: parseFloat(a.height) || 0, w: parseFloat(a.width) || 0 };
    });
    expect(touch.h, name).toBeGreaterThanOrEqual(40);
    expect(touch.w, name).toBeGreaterThanOrEqual(40);
  }
});

test("the HUD button is at the top right of the Selected Node's name, slim to look at and 44 px to touch, with no row of its own", async ({ page }) => {
  await open(page);
  const button = sheet(page).getByRole("button", { name: "HUD", exact: true });
  const name = (await sheet(page).getByRole("heading", { level: 2 }).boundingBox())!,
    b = (await button.boundingBox())!,
    actions = (await sheet(page).getByRole("button", { name: "Pin", exact: true }).boundingBox())!;
  // On the name's line, at the right end of the sheet, above the actions.
  expect(b.y).toBeLessThan(name.y + name.height);
  expect(b.y + b.height).toBeLessThan(actions.y);
  expect(b.x + b.width).toBeGreaterThan(390 - 40);
  expect(b.height).toBeLessThanOrEqual(28);
  const touch = await button.evaluate((e) => {
    const a = getComputedStyle(e, "::after");
    return { h: parseFloat(a.height) || 0, w: parseFloat(a.width) || 0 };
  });
  expect(touch.h).toBeGreaterThanOrEqual(44);
  expect(touch.w).toBeGreaterThanOrEqual(44);
  // Shown in the sheet's peek, without opening it, and it works from there.
  await button.tap();
  await expect(hud(page)).toBeVisible();
  // A long name is cut short of it.
  await hud(page).getByRole("button", { name: "Details" }).tap();
  await expect(button).toBeVisible();
});

test("the sheet's section chips sit under the held block, are 44 px to touch, and the HUD opens at the one chosen (decision 238)", async ({ page }) => {
  await open(page);
  await openSheet(page);
  const chips = sheet(page).getByRole("toolbar", { name: "Sections" });
  await expect(chips.getByRole("button")).toHaveText(["Overview", "Links", "Verses", "Map", "Note"]);
  const verses = chips.getByRole("button", { name: "Verses" });
  const touch = await verses.evaluate((e) => {
    const a = getComputedStyle(e, "::after");
    return { h: parseFloat(a.height) || 0, box: e.getBoundingClientRect().height };
  });
  expect(touch.h).toBeGreaterThanOrEqual(44);
  expect(touch.box).toBeLessThanOrEqual(30);
  await verses.tap();
  await expect(verses).toHaveAttribute("aria-current", "true");
  // The chip row stays in view as the sheet scrolls, and the section lands below it.
  const row = (await chips.boundingBox())!;
  const heading = sheet(page).getByRole("heading", { name: /^In \d+ verses$/ });
  await expect(heading).toBeInViewport();
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(row.y + row.height - 1);
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();
  await expect(hud(page).getByRole("tab", { name: "Verses" })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: process.env.CHIPS_SHOT_HUD ?? "test-results/chips-hud.png" });
  await hud(page).getByRole("button", { name: "Details" }).tap();
  await expect(chips.getByRole("button", { name: "Verses" })).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: process.env.CHIPS_SHOT ?? "test-results/chips-sheet.png" });
});

test("on a phone, Read on the docked HUD opens a HUD-styled reader modal and the sheet stays away", async ({ page }) => {
  await open(page);
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();
  await expect(hud(page)).toBeVisible();
  await hud(page).getByRole("button", { name: "Read", exact: true }).tap();
  const modal = page.getByRole("group", { name: "Reader (HUD)" });
  await expect(modal.getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(page.locator(".sheet.away")).toHaveCount(1);
  const box = (await modal.boundingBox())!;
  expect(box.x).toBeCloseTo(8, 0);
  expect(box.width).toBeCloseTo(390 - 16, 0);
  await modal.getByRole("button", { name: "Close reader" }).tap();
  await expect(modal).toHaveCount(0);
  await expect(hud(page)).toBeVisible();
});
