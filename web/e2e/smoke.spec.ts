import { expect, test } from "@playwright/test";
import { focusIs, nodes } from "./scene";

test("the page opens on Abraham in the tilted plane", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  const drawn = await nodes(page);
  const size = page.viewportSize()!;
  // Fixture: Abraham's scene is 105 nodes (tests/model.test.ts), drawn around him at the centre.
  expect(drawn).toHaveLength(105);
  const focus = drawn.find((n) => n.role === "focus")!;
  expect(focus.id).toBe("person:abraham_58");
  expect(Math.abs(focus.x - size.width / 2)).toBeLessThan(size.width / 4);
  expect(Math.abs(focus.y - size.height / 2)).toBeLessThan(size.height / 4);
  await expect(page.locator(".nl.focus")).toContainText("Abraham");
  // Named, though the name may give way to a Ring 1 name it would overlap (decision 124).
  await expect(page.getByText("+18 people")).toBeAttached();
});

test("a Verse can be the Focus, with a short BSB quote", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:5");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await focusIs(page, "01025005");
  const drawn = await nodes(page);
  expect(drawn.find((n) => n.role === "focus")?.id).toBe("01025005");
  // Fixture: Gen 25:5 names Isaac and Abraham, is filed under HEIR, and has Gal 3:29 (5 Votes).
  expect(drawn.filter((n) => n.role === "ring1").map((n) => n.id)).toEqual(
    expect.arrayContaining(["person:isaac_616", "person:abraham_58", "theme:heir", "48003029"]),
  );
  // The Focus label holds the reference, then the quote.
  await expect(page.locator(".nl.focus")).toHaveText("Gen 25:5Abraham left everything he owned to Isaac.");
});

test("a long quote wraps and stops after three lines", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  // Fixture: Gen 25:8 is one sentence of 103 characters.
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:8");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await focusIs(page, "01025008");
  const quote = page.locator(".nl.focus .quote");
  const { width, height } = (await quote.boundingBox())!;
  const line = parseFloat(await quote.evaluate((q) => getComputedStyle(q).lineHeight));
  expect(width).toBeLessThanOrEqual(240);
  expect(height).toBeGreaterThan(line);
  expect(height).toBeLessThanOrEqual(3 * line + 1);
});
