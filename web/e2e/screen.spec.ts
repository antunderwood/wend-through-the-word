import { expect, test } from "@playwright/test";
import { openOnAbraham } from "./scene";

test("a desktop has a fine pointer, and a window 640 px wide or less has the phone layout", async ({ page }) => {
  await openOnAbraham(page);
  const root = page.locator("html");
  await expect(root).not.toHaveAttribute("data-phone");
  await expect(root).not.toHaveAttribute("data-coarse");
  // The breakpoint is 640 px wide or less (decision 115).
  await page.setViewportSize({ width: 641, height: 720 });
  await expect(root).not.toHaveAttribute("data-phone");
  await page.setViewportSize({ width: 640, height: 720 });
  await expect(root).toHaveAttribute("data-phone");
  await expect(root).not.toHaveAttribute("data-coarse");
  // A short window with a mouse keeps the desktop layout: only a touch screen under 500 px tall is
  // a phone on its side (decision 184).
  await page.setViewportSize({ width: 900, height: 400 });
  await expect(root).not.toHaveAttribute("data-phone");
  await expect(root).not.toHaveAttribute("data-side");
});

test("a desktop keeps a notice: it does not fade as on a phone (decision 183)", async ({ page }) => {
  await openOnAbraham(page);
  await page.getByRole("searchbox", { name: "Search" }).fill("Abraham");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().click();
  const notice = page.getByRole("status");
  await expect(notice).toHaveText("Abraham is already the Focus.");
  await page.waitForTimeout(4000); // past the phone's few seconds
  await expect(notice).toHaveCSS("opacity", "1");
  await expect(notice).toBeVisible();
});
