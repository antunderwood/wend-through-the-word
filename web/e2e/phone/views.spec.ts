import { expect, test, type Page } from "@playwright/test";
import { nodes } from "../scene";

const sceneReady = (page: Page) => page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });
const positions = async (page: Page) => (await nodes(page)).map(({ id, x, y }) => ({ id, x: Math.round(x), y: Math.round(y) }));

test("a phone offers the tilted plane and the free orbit only", async ({ page }) => {
  await page.goto("/");
  await sceneReady(page);
  await expect(picker(page).getByRole("radio")).toHaveText(["Tilted plane", "Free orbit"]);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  // The keys step over the stacked discs. (A key, not a tap: until the bottom sheet, #76, moves the
  // footer, it lies over the picker on a phone.)
  await picker(page).getByRole("radio", { name: "Tilted plane" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(picker(page).getByRole("radio", { name: "Free orbit" })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("wend.view"))).toBe("C");
});

test("a link with the stacked discs opens in the tilted plane, and the address keeps them", async ({ page }) => {
  await page.goto("/");
  await sceneReady(page);
  const tilted = await positions(page);

  await page.goto("/?view=B");
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  expect(await positions(page)).toEqual(tilted);
  expect(new URL(page.url()).searchParams.get("view")).toBe("B");
});

test("the stacked discs kept in this browser show as the tilted plane, and stay kept", async ({ page }) => {
  await page.goto("/");
  await sceneReady(page);
  const tilted = await positions(page);
  await page.evaluate(() => localStorage.setItem("wend.view", "B"));

  await page.goto("/");
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  expect(await positions(page)).toEqual(tilted);
  expect(await page.evaluate(() => localStorage.getItem("wend.view"))).toBe("B");
});
