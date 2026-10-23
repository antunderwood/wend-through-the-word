import { expect, test } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";

// Fixture: Abraham's Easton entry starts "Father of a multitude, son of Terah" (e2e/look.spec.ts).
test("the Focus label has no dictionary subtitle on a phone", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  await expect(page.locator(".nl.focus")).toBeVisible();
  await expect(page.locator(".nl.focus").getByText("Father of a multitude, son of Terah")).toBeHidden();
});

test("a Verse Focus drops its BSB quote on a phone too (owner)", async ({ page }) => {
  await page.goto("/?focus=Gen.25.5");
  await focusIs(page, "01025005");
  await expect(page.locator(".nl.focus")).toBeVisible();
  await expect(page.locator(".nl.focus").getByText("Abraham left everything he owned to Isaac.")).toBeHidden();
});
