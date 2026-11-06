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

test("on a phone on its side the sheet stays and the HUD is not offered", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await open(page);
  await expect(hud(page)).toHaveCount(0);
  await expect(sheet(page).getByRole("button", { name: "HUD", exact: true })).toHaveCount(0);
});
