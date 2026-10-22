import { expect, test } from "@playwright/test";

test("a desktop has a fine pointer, and a window 640 px wide or less has the phone layout", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).not.toHaveAttribute("data-phone");
  await expect(root).not.toHaveAttribute("data-coarse");
  // The breakpoint is 640 px wide or less (decision 115).
  await page.setViewportSize({ width: 641, height: 720 });
  await expect(root).not.toHaveAttribute("data-phone");
  await page.setViewportSize({ width: 640, height: 720 });
  await expect(root).toHaveAttribute("data-phone");
  await expect(root).not.toHaveAttribute("data-coarse");
});
