import { expect, test, type Page } from "@playwright/test";
import { openView, viewMenu } from "../touch";
import { nodes, openOnAbraham } from "../scene";

// The scene is drawn and has settled: on a phone the sheet's peek height is measured after the first
// frame (decision 214), and the camera eases to the space above it.
async function sceneReady(page: Page) {
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
  let last = "";
  await expect.poll(async () => last === (last = JSON.stringify(await page.evaluate(() => window.wendGraph!.testNodes().map((n) => [n.id, Math.round(n.x), Math.round(n.y)]))))).toBe(true);
}
const picker = (page: Page) => viewMenu(page).getByRole("radiogroup", { name: "View" });
const positions = async (page: Page) => (await nodes(page)).map(({ id, x, y }) => ({ id, x: Math.round(x), y: Math.round(y) }));

test("a phone offers the tilted plane and the free orbit only", async ({ page }) => {
  await openOnAbraham(page);
  await sceneReady(page);
  await openView(page);
  await expect(picker(page).getByRole("radio")).toHaveText(["Tilted plane", "Free orbit"]);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  // The picker is in the View popover, not the Details tab (decision 236). The keys step over the stacked discs.
  await expect(page.getByRole("tabpanel", { name: "Details" }).getByRole("radiogroup", { name: "View" })).toHaveCount(0);
  await picker(page).getByRole("radio", { name: "Tilted plane" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(picker(page).getByRole("radio", { name: "Free orbit" })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("wend.view"))).toBe("C");
  await picker(page).getByRole("radio", { name: "Tilted plane" }).tap();
  await expect(picker(page).getByRole("radio", { name: "Tilted plane" })).toBeChecked();
});

test("a link with the stacked discs opens in the tilted plane, and the address keeps them", async ({ page }) => {
  await openOnAbraham(page);
  await sceneReady(page);
  const tilted = await positions(page);

  await page.goto("/?view=B");
  await sceneReady(page);
  await openView(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  expect(await positions(page)).toEqual(tilted);
  expect(new URL(page.url()).searchParams.get("view")).toBe("B");
});

test("the stacked discs kept in this browser show as the tilted plane, and stay kept", async ({ page }) => {
  await openOnAbraham(page);
  await sceneReady(page);
  const tilted = await positions(page);
  await page.evaluate(() => localStorage.setItem("wend.view", "B"));

  await page.goto("/");
  await sceneReady(page);
  await openView(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  expect(await positions(page)).toEqual(tilted);
  expect(await page.evaluate(() => localStorage.getItem("wend.view"))).toBe("B");
});
