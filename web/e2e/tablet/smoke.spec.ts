import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";

test("a tablet loads the page and walks to Abraham by search and touch", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616");
  await focusIs(page, "person:isaac_616");
  await page.getByRole("searchbox", { name: "Search" }).fill("Abraham");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
  await focusIs(page, "person:abraham_58");
});

test("a tablet keeps the desktop layout with a coarse pointer, upright or sideways", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-coarse");
  await expect(root).not.toHaveAttribute("data-phone");
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(root).toHaveAttribute("data-coarse");
  await expect(root).not.toHaveAttribute("data-phone");
});
