import { expect, test, type Page } from "@playwright/test";

const focusOf = (page: Page) => page.evaluate(() => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id);

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => focusOf(page)).toBe("person:abraham_58");
});

test('a click on a search result makes it the Focus at once and closes the list: "Abraham"', async ({ page }) => {
  const box = page.getByRole("searchbox", { name: "Search" });
  const results = page.getByRole("list", { name: "Search results" });
  // The page opens on Abraham, so move away first.
  await box.fill("Isaac");
  await results.getByRole("button").first().click();
  await expect.poll(() => focusOf(page)).toBe("person:isaac_616");

  await box.fill("Abraham");
  const first = results.getByRole("button").first();
  await expect(first).toContainText("Abraham");
  await first.click();
  await expect.poll(() => focusOf(page)).toBe("person:abraham_58");
  await expect(box).toHaveValue("");
  await expect(results).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Abraham is the Focus.");
});

test("Enter picks the first result, within the chosen type", async ({ page }) => {
  const box = page.getByRole("searchbox", { name: "Search" });
  // Fixture: Canaan is a Person and a Place; the Person comes first with no type chosen.
  await box.fill("Canaan");
  await page.getByRole("group", { name: "Filter by type" }).getByRole("button", { name: "Place" }).click();
  await box.press("Enter");
  await expect.poll(() => focusOf(page)).toBe("place:canaan_272");
  await expect(page.getByRole("list", { name: "Search results" })).toBeHidden();
});

test("search results, the scene label, and the panel tell same-name Entities apart", async ({ page }) => {
  // Fixture: three People named Anah (decision 122).
  await page.getByRole("searchbox", { name: "Search" }).fill("Anah");
  await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Anah \(Gen 36:24\)/ }).click();
  await expect.poll(() => focusOf(page)).toBe("person:anah_249");
  await expect(page.locator(".labels").getByText("Anah (Gen 36:24)", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 })).toHaveText("Anah (Gen 36:24)");
});
