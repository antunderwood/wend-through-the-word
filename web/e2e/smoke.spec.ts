import { expect, test } from "@playwright/test";

type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
  }
}

test("the page opens on Abraham in the tilted plane", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  const nodes = await page.evaluate(() => window.wendGraph!.testNodes());
  const size = page.viewportSize()!;
  // Fixture: Abraham's scene is 99 nodes (tests/model.test.ts), drawn around him at the centre.
  expect(nodes).toHaveLength(99);
  const focus = nodes.find((n) => n.role === "focus")!;
  expect(focus.id).toBe("person:abraham_58");
  expect(Math.abs(focus.x - size.width / 2)).toBeLessThan(size.width / 4);
  expect(Math.abs(focus.y - size.height / 2)).toBeLessThan(size.height / 4);
  await expect(page.locator(".nl.focus")).toContainText("Abraham");
  await expect(page.getByText("+15 people")).toBeVisible();
});

test("a Verse can be the Focus, with a short BSB quote", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:5");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await page.waitForFunction(() => window.wendGraph!.testNodes().find((n) => n.role === "focus")?.id === "01025005");
  const nodes = await page.evaluate(() => window.wendGraph!.testNodes());
  expect(nodes.find((n) => n.role === "focus")?.id).toBe("01025005");
  // Fixture: Gen 25:5 names Isaac and Abraham, is filed under HEIR, and has Gal 3:29 (5 Votes).
  expect(nodes.filter((n) => n.role === "ring1").map((n) => n.id)).toEqual(
    expect.arrayContaining(["person:isaac_616", "person:abraham_58", "theme:heir", "48003029"]),
  );
  // The Focus label holds the reference, then the quote.
  await expect(page.locator(".nl.focus")).toHaveText("Gen 25:5Abraham left everything he owned to Isaac.");
});
