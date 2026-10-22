import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";

test("a phone loads the page and walks to Abraham by search and touch", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616");
  await focusIs(page, "person:isaac_616");
  await page.getByRole("button", { name: "Search" }).tap();
  await page.getByRole("searchbox", { name: "Search" }).fill("Abraham");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
  await focusIs(page, "person:abraham_58");
});

test("a phone has the phone layout and a coarse pointer, and loses the layout sideways", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-phone");
  await expect(root).toHaveAttribute("data-coarse");
  // Sideways the phone is 844 px wide: wider than the phone layout (decision 115).
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(root).not.toHaveAttribute("data-phone");
  await expect(root).toHaveAttribute("data-coarse");
});
