import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "./scene";
import { backTo, bare, centred, offCentre, recentreInReach } from "./recentre";
import { STEPS } from "../src/tour";

// A desktop has the Recentre button too (decision 188): in the scene's top left corner, clear of the
// panel, the reader drawer, and the controls, reachable by the keyboard. It puts the camera back at
// the view's start round the Focus, and the tour undoes its pan for a step when the step ends.
const ABRAHAM = "person:abraham_58",
  JESUS = "person:jesus_905",
  GOD = "person:god_1324";
const recentre = (page: Page) => page.getByRole("button", { name: "Recentre", exact: true });
const tour = (page: Page) => page.getByRole("dialog", { name: "Tour" });
// A pan as the tour makes one: God's disc moved 150 px right and 100 px down.
const panGod = (page: Page, zoomOut = 1) =>
  page.evaluate(
    ([id, zoomOut]) => {
      const r = window.wendGraph!.nodeRect(id)!;
      window.wendGraph!.panTo(id, r.x + r.width / 2 + 150, r.y + r.height / 2 + 100, zoomOut);
    },
    [GOD, zoomOut] as const,
  );

test.use({ reducedMotion: "reduce" });

// What Recentre must leave as it was: the address (Focus, Selected Node, pins, view) and Your Path.
const kept = async (page: Page) => ({
  address: new URL(page.url()).search,
  path: await page.getByRole("navigation", { name: "Your Path" }).getByRole("listitem").allTextContents(),
});

test("Recentre undoes a drag, a zoom, and a tour's pan, and keeps the Focus, selection, and Your Path", async ({ page }) => {
  await openOnAbraham(page, `/?sel=person:sarah_2473`);
  await focusIs(page, ABRAHAM);
  const start = await nodes(page),
    before = await kept(page);
  const button = await recentreInReach(page, 32);

  const from = (await bare(page))!;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => offCentre(page)).toBeGreaterThan(20);
  await button.click();
  await backTo(page, start);

  await page.mouse.move(from.x, from.y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Math.max(...(await nodes(page)).map((n, i) => Math.hypot(n.x - start[i].x, n.y - start[i].y)))).toBeGreaterThan(20);
  await button.click();
  await backTo(page, start);

  await page.evaluate((id) => window.wendGraph!.panTo(id, 300, 250, 1.25), ABRAHAM);
  await expect.poll(() => offCentre(page)).toBeGreaterThan(50);
  await button.click();
  await backTo(page, start);
  expect(await kept(page)).toEqual(before);
});

test("the keyboard reaches Recentre from the scene, and Enter on it recentres", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  const start = await nodes(page);
  await page.evaluate((id) => window.wendGraph!.panTo(id, 300, 250), ABRAHAM);
  await page.getByRole("application").focus();
  await page.keyboard.press("Tab");
  await expect(recentre(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await backTo(page, start);
});

test("Recentre is clear of the panel, the reader drawer, and the controls, open or closed", async ({ page }) => {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size);
    await openOnAbraham(page);
    await focusIs(page, ABRAHAM);
    await recentreInReach(page, 32);
    await page.getByRole("complementary", { name: "Selected Node" }).getByRole("button", { name: "Read", exact: true }).click();
    await expect(page.getByRole("region", { name: "Reader" })).toBeVisible();
    await recentreInReach(page, 32);
    await page.getByRole("button", { name: "Hide panel" }).click();
    await recentreInReach(page, 32);
  }
});

test("a pan the tour made for a step is undone when the step ends, and when the tour ends", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, JESUS);
  await page.getByRole("button", { name: "Help: take the tour" }).click();
  await expect(tour(page)).toContainText(`Step 1 of ${STEPS.length}`);
  await tour(page).getByRole("button", { name: "Do it for me" }).click();
  await expect(tour(page)).toContainText(`Step 2 of ${STEPS.length}`);
  await tour(page).getByRole("button", { name: "Do it for me" }).click();
  await expect(tour(page)).toContainText(`Step 3 of ${STEPS.length}`);
  await recentreInReach(page, 32);
  // The camera step zoomed in; the scene as step 3 shows it, then a pan as the tour makes one.
  await centred(page);
  const shown = await nodes(page);
  await panGod(page);
  await expect.poll(() => offCentre(page)).toBeGreaterThan(50);
  await tour(page).getByRole("button", { name: "Do it for me" }).click();
  await expect(tour(page)).toContainText(`Step 4 of ${STEPS.length}`);
  await backTo(page, shown);

  await panGod(page, 1.25);
  await expect.poll(() => offCentre(page)).toBeGreaterThan(50);
  await tour(page).getByRole("button", { name: "End tour" }).click();
  await expect(tour(page)).toBeHidden();
  await centred(page);
});
