import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "../scene";
import { doubleTap, drag, pageMoved } from "../touch";
import { selectedIs } from "../touch-input";

// Your Path in the phone's top bar (decision 183): a double tap on a step makes it the Focus
// (decision 205), and a sideways drag scrolls the steps without counting as a tap.
const HAGAR = "person:hagar_1348",
  SARAH = "person:sarah_2473";

test.use({ reducedMotion: "reduce", viewport: { width: 325, height: 600 } });

const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
// The middle of a step's button.
async function centreOf(page: Page, name: string) {
  const b = (await bar(page).getByRole("button", { name, exact: true }).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Hagar the Focus, with a Path long enough to scroll in the bar: Hagar, Sarah, Absalom, Adam, Isaac, Abraham.
test.beforeEach(async ({ page }) => {
  const kept = { focus: HAGAR, path: ["person:abraham_58", "person:isaac_616", "person:adam_78", "person:absalom_59", SARAH] };
  await page.addInitScript((kept) => {
    localStorage.setItem("wend.hintDismissed", "1");
    localStorage.getItem("wend.journey") || localStorage.setItem("wend.journey", kept);
  }, JSON.stringify(kept));
  await page.goto("/");
  await focusIs(page, HAGAR);
  await expect(bar(page).getByRole("listitem")).toHaveText(["Hagar", "Sarah", "Absalom", "Adam", "Isaac", "Abraham"]);
});

test("a double tap on a step makes it the Focus, and the page does not zoom", async ({ page }) => {
  await doubleTap(page, await centreOf(page, "Sarah"));
  await focusIs(page, SARAH);
  await expect(page).toHaveURL(/focus=person:sarah_2473/);
  expect(await pageMoved(page)).toEqual({ scale: 1, x: 0, y: 0 });
});

test("a sideways drag in the bar scrolls the steps and is never a tap", async ({ page }) => {
  const steps = bar(page).getByRole("list");
  const from = await centreOf(page, "Sarah");
  // Two drags in quick succession from the same step: neither a tap nor a double tap.
  await drag(page, from, { x: from.x - 120, y: from.y });
  await drag(page, from, { x: from.x - 120, y: from.y });
  await expect.poll(() => steps.evaluate((ol) => ol.scrollLeft)).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await focusIs(page, HAGAR);
  await selectedIs(page, HAGAR);
  expect(await pageMoved(page)).toEqual({ scale: 1, x: 0, y: 0 });
});
