import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "../scene";

const ABRAHAM = "person:abraham_58";

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await focusIs(page, ABRAHAM);
}

test("the search button opens search with the keyboard ready, and choosing a result makes it the Focus and closes search", async ({ page }) => {
  await open(page);
  const box = page.getByRole("searchbox", { name: "Search" });
  await expect(box).toBeHidden();
  await page.getByRole("button", { name: "Search" }).tap();
  await expect(box).toBeFocused();
  // Over the top of the scene, across the screen.
  const b = (await page.getByRole("search").boundingBox())!;
  expect(b.y).toBeLessThan(20);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);

  await page.keyboard.type("Isaac");
  // The type chips and the results are large enough to tap.
  const small = await page
    .getByRole("search")
    .evaluate((s) => [...s.querySelectorAll("button")].filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent!.trim()));
  expect(small).toEqual([]);
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
  await focusIs(page, "person:isaac_616");
  await expect(box).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
});

test("search closes on Escape and on a tap outside it", async ({ page }) => {
  await open(page);
  const box = page.getByRole("searchbox", { name: "Search" });
  await page.getByRole("button", { name: "Search" }).tap();
  await expect(box).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();

  await page.getByRole("button", { name: "Search" }).tap();
  await expect(box).toBeVisible();
  // A tap on the scene, below the search box and above the sheet.
  await page.touchscreen.tap(195, 300);
  await expect(box).toBeHidden();
  await focusIs(page, ABRAHAM);
});

test("search left open closes when the window widens past the phone layout and narrows again", async ({ page }) => {
  await open(page);
  const box = page.getByRole("searchbox", { name: "Search" });
  await page.getByRole("button", { name: "Search" }).tap();
  await expect(box).toBeFocused();
  // The desktop layout always shows the box; back on a phone it is a button again.
  await page.setViewportSize({ width: 900, height: 844 });
  await expect(box).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(box).toBeHidden();
});

test("the page does not zoom when the search box is focused: its text is at least 16 px", async ({ page }) => {
  // A phone browser zooms in on a text field whose text is smaller than 16 px.
  await open(page);
  await page.getByRole("button", { name: "Search" }).tap();
  const size = await page.getByRole("searchbox", { name: "Search" }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
});

test("the search button is large enough to tap and does not cover Your Path", async ({ page }) => {
  await open(page);
  const button = (await page.getByRole("button", { name: "Search" }).boundingBox())!;
  const bar = (await page.getByRole("navigation", { name: "Your Path" }).boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.width).toBeGreaterThanOrEqual(44);
  expect(button.x + button.width).toBeLessThanOrEqual(390);
  expect(bar.x + bar.width).toBeLessThanOrEqual(button.x);
});
