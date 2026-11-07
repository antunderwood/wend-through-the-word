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
  // The HUD button is in the row at the top of the Details tab.
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "HUD", exact: true }).tap();

  // The sheet closes to its row and the HUD sits just above it, across the screen.
  await expect(page.locator(".sheet.collapsed")).toHaveCount(1);
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  const card = (await hud(page).boundingBox())!,
    row = (await sheet(page).getByRole("tablist", { name: "Sheet" }).boundingBox())!;
  expect(card.x).toBeCloseTo(8, 0);
  expect(card.width).toBeCloseTo(390 - 16, 0);
  expect(card.y + card.height).toBeLessThanOrEqual(row.y);
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
  await expect(page.locator(".sheet.peek, .sheet.collapsed")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
  await expect(hud(page)).toBeVisible();
  // The handle opens the sheet to half, not to a peek the HUD would cover.
  await sheet(page).getByRole("button", { name: "Open the sheet" }).tap();
  await expect(page.locator(".sheet.peek, .sheet.collapsed")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();

  // Hide HUD goes back to the sheet's peek.
  await hud(page).getByRole("button", { name: "Hide HUD" }).tap();
  await expect(hud(page)).toHaveCount(0);
  await expect(page.locator(".sheet.peek")).toHaveCount(1);
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
  expect(boxes.length).toBeGreaterThanOrEqual(3);
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
  // The card stays above the sheet's row and under the top bar.
  const row = (await sheet(page).getByRole("tablist", { name: "Sheet" }).boundingBox())!;
  expect(big.y + big.height).toBeLessThanOrEqual(row.y);
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
  const bar = (await card.boundingBox())!,
    row = (await sheet(page).getByRole("tablist", { name: "Sheet" }).boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(56);
  expect(bar.height).toBeLessThan(docked.height / 3);
  expect(bar.y + bar.height).toBeLessThanOrEqual(row.y);
  // The selection and Focus stay where they were.
  await focusIs(page, ABRAHAM);
  await page.screenshot({ path: process.env.HUD_MIN_SHOT ?? "test-results/hud-minimised.png" });

  // Tapping the bar brings the HUD back at the docked size.
  await card.locator(".mini-name").tap();
  await expect(card.getByRole("button", { name: "Minimise HUD" })).toBeVisible();
  expect((await card.boundingBox())!.height).toBeCloseTo(docked.height, 0);

  // A node tapped while minimised changes the name on the bar.
  await card.getByRole("button", { name: "Minimise HUD" }).tap();
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.touchscreen.tap(isaac.x, isaac.y);
  await expect(card).toContainText("Isaac");
  await expect(card.getByRole("tab")).toHaveCount(0);
  await card.getByRole("button", { name: "Restore HUD" }).tap();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Isaac");
});
