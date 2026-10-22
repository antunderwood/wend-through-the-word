import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";

// Fixture: Abraham's Easton entry starts "Father of a multitude, son of Terah" (e2e/look.spec.ts).
test("the Focus label has no dictionary subtitle on a phone, and gets it back on a wider screen", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  await expect(page.locator(".nl.focus")).toBeVisible();
  const subtitle = page.locator(".nl.focus").getByText("Father of a multitude, son of Terah");
  await expect(subtitle).toBeHidden();
  // Sideways the phone is wider than the phone layout (decision 115).
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(subtitle).toBeVisible();
});

test("a Verse Focus keeps its BSB quote on a phone: it is the Verse, not a dictionary subtitle", async ({ page }) => {
  await page.goto("/?focus=Gen.25.5");
  await focusIs(page, "01025005");
  await expect(page.locator(".nl.focus").getByText("Abraham left everything he owned to Isaac.")).toBeVisible();
});
