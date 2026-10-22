import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "../scene";

// The correction dialog and the credits page on a phone: whole within 390 px and nothing to scroll
// sideways. The dialog's links and button are large enough to tap; the credits page's links are in
// its text.
const ANAH = "person:anah_247";

test.use({ reducedMotion: "reduce" });

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// The links and buttons in a box drawn less than 44 px tall, by their text.
const small = (l: Locator) =>
  l.evaluate((root) =>
    [...root.querySelectorAll("a, button")]
      .filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 44)
      .map((e) => `${e.textContent!.trim().slice(0, 30)}: ${e.getBoundingClientRect().height}`),
  );

test("the correction dialog fits the phone, and its links are large enough to tap", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/?focus=" + ANAH);
  await focusIs(page, ANAH);
  await page.getByRole("tabpanel", { name: "Details" }).getByRole("button", { name: "Suggest a correction", exact: true }).tap();
  const dialog = page.getByRole("dialog", { name: "Suggest a correction" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(390 - 8);
  await expect(dialog).toBeInViewport({ ratio: 1 });
  expect(await sideways(page)).toBe(0);
  expect(await small(dialog)).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel" }).tap();
  await expect(dialog).toBeHidden();
});

test("the credits page fits the phone with nothing to scroll sideways", async ({ page }) => {
  await page.goto("/credits.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About and credits");
  await expect(page.getByRole("listitem").first()).toBeVisible();
  expect(await sideways(page)).toBe(0);
  for (const link of await page.getByRole("link").all()) {
    const b = (await link.boundingBox())!,
      name = (await link.textContent())!;
    expect(b.x, name).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, name).toBeLessThanOrEqual(390);
  }
  await page.getByRole("link", { name: "Back to the graph" }).tap();
  await focusIs(page, "person:abraham_58");
});
