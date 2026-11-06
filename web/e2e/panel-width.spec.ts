import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "./scene";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const edge = (page: Page) => page.getByRole("separator", { name: "Resize panel" });
const width = async (page: Page) => Math.round((await panel(page).boundingBox())!.width);

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
});

test("the panel's left edge sizes it by drag and by keys, the width is kept, and a double click resets it", async ({ page }) => {
  expect(await width(page)).toBe(340);
  const e = (await edge(page).boundingBox())!;
  await page.mouse.move(e.x + e.width / 2, e.y + 200);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2 - 160, e.y + 200, { steps: 5 });
  await page.mouse.up();
  expect(await width(page)).toBe(500);
  // The scene gives up the room.
  const canvas = (await page.locator(".stage canvas").boundingBox())!;
  expect(Math.round(canvas.x + canvas.width)).toBe(page.viewportSize()!.width - 500);

  await edge(page).press("ArrowRight");
  expect(await width(page)).toBe(484);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "484");

  await page.reload();
  await expect.poll(() => width(page)).toBe(484);

  await edge(page).dblclick();
  expect(await width(page)).toBe(340);
  await page.reload();
  await expect.poll(() => width(page)).toBe(340);
});

test("the panel is never so wide the scene loses its room, nor narrower than its least", async ({ page }) => {
  const vw = page.viewportSize()!.width;
  await edge(page).focus();
  for (let i = 0; i < 20; i++) await edge(page).press("Shift+ArrowLeft");
  expect(await width(page)).toBe(Math.min(720, vw - 360));
  for (let i = 0; i < 20; i++) await edge(page).press("Shift+ArrowRight");
  expect(await width(page)).toBe(280);
});

test("the handle goes with the panel when it is hidden", async ({ page }) => {
  await page.getByRole("button", { name: "Hide panel" }).click();
  await expect(edge(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Show panel" }).click();
  await expect(edge(page)).toBeVisible();
});
