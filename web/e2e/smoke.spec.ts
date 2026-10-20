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
  await expect(page.locator(".labels").getByText("Abraham", { exact: true })).toBeVisible();
  await expect(page.getByText("+15 people")).toBeVisible();
});
