import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";

test.use({ reducedMotion: "reduce", viewport: { width: 325, height: 600 } });

// The owner's phone: the Details tab's shared Verses show the names bold, as on a desktop (#111).
test("the Details tab's shared Verses show the Selected Node's and the Focus's names bold", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/?focus=person:sarah_2473&sel=person:abraham_58");
  await focusIs(page, "person:sarah_2473");
  const details = page.getByRole("region", { name: "Sheet" }).getByRole("tabpanel", { name: "Details" });
  const verse = details.getByRole("list", { name: /^Together in/ }).getByRole("listitem").filter({ hasText: "Gen 25:10" });
  const text = verse.locator(".verse-text");
  await text.scrollIntoViewIfNeeded();
  await expect(text.locator("strong")).toHaveText(["Abraham", "Abraham", "Sarah"]);
  expect(await text.evaluate((p) => p.textContent)).toBe("This was the field that Abraham had bought from the Hittites. Abraham was buried there with his wife Sarah.");
  await expect(text.locator("strong").last()).toBeVisible();
});
