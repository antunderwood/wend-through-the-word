import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "../scene";
import { drag } from "../touch";
import { backTo, bare, centred, offCentre, pinchOut, recentreInReach } from "../recentre";
import { STEPS } from "../../src/tour";

// The view follows the sheet (decision 188): whenever the sheet opens, closes, or snaps to another
// height, or the phone turns, the camera eases so the Focus is in the middle of the free scene, also
// after a drag, a pinch, or a pan the tour made had moved it from there.
const ABRAHAM = "person:abraham_58";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const handle = (page: Page) => sheet(page).getByRole("button", { name: /the sheet$/ });

test.use({ reducedMotion: "reduce" });
// Each test is many gestures, each waiting for the scene on software WebGL: three times as long.
test.slow();

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await centred(page);
}
// A finger drags the camera 50 px from a bare point of the scene, and the Focus moves off centre.
async function moveCamera(page: Page) {
  const from = await bare(page);
  expect(from).not.toBeNull();
  await drag(page, from!, { x: from!.x + 30, y: from!.y + 40 });
  await expect.poll(() => offCentre(page)).toBeGreaterThan(20);
}
// A finger drags the sheet's row to y.
async function dragSheet(page: Page, y: number) {
  const row = (await handle(page).boundingBox())!;
  await drag(page, { x: row.x + row.width / 2, y: row.y + row.height / 2 }, { x: row.x + row.width / 2, y });
}

for (const size of [{ width: 325, height: 600 }])
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("after a drag, a tap on the handle or a drag of the sheet to each height centres the Focus in the free scene", async ({ page }) => {
      await open(page);
      await moveCamera(page);
      await handle(page).tap(); // closed
      await centred(page);
      await moveCamera(page);
      await handle(page).tap(); // half
      await centred(page);
      await moveCamera(page);
      await dragSheet(page, 100); // full
      await centred(page);
      await moveCamera(page);
      await dragSheet(page, size.height * 0.55); // half
      await centred(page);
      await moveCamera(page);
      await dragSheet(page, size.height - 10); // closed
      await centred(page);
    });

    test("after a pan the tour made, a change of the sheet centres the Focus", async ({ page }) => {
      await open(page);
      await page.evaluate((id) => window.wendGraph!.panTo(id, 60, 80, 1.25), ABRAHAM);
      await expect.poll(() => offCentre(page)).toBeGreaterThan(50);
      await handle(page).tap();
      await centred(page);
    });

    test.describe("with animation", () => {
      test.use({ reducedMotion: "no-preference" });

      test("the camera eases the Focus into the middle of the free scene", async ({ page }) => {
        await open(page);
        await moveCamera(page);
        await handle(page).tap();
        await centred(page);
        await moveCamera(page);
        await handle(page).tap();
        await centred(page);
      });
    });
  });

// The Recentre button puts the camera back at the view's start round the Focus, after a drag, a
// pinch, and a pan the tour made, on every phone screen, with the sheet open or closed; the Focus,
// the Selected Node, and Your Path stay.
for (const size of [
  { width: 325, height: 600 },
  { width: 760, height: 330 },
])
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("Recentre undoes a drag, a pinch, and a tour's pan, and keeps the Focus, selection, and Your Path", async ({ page }) => {
      await open(page);
      const start = await nodes(page);
      const kept = async () => ({ address: new URL(page.url()).search, path: await page.getByRole("navigation", { name: "Your Path" }).getByRole("listitem").allTextContents() });
      const before = await kept();
      for (const closed of [false, true]) {
        if (closed) {
          await handle(page).tap();
          await centred(page);
        }
        const recentre = await recentreInReach(page, 40);
        const at = await nodes(page);
        await moveCamera(page);
        await recentre.tap();
        await backTo(page, at);
        await pinchOut(page);
        await expect.poll(() => offCentre(page)).toBeGreaterThan(5);
        await recentre.tap();
        await backTo(page, at);
        await page.evaluate((id) => window.wendGraph!.panTo(id, 60, 80, 1.25), ABRAHAM);
        await expect.poll(() => offCentre(page)).toBeGreaterThan(50);
        await recentre.tap();
        await backTo(page, at);
      }
      await handle(page).tap();
      await backTo(page, start);
      expect(await kept()).toEqual(before);
    });
  });

// The owner's report: the tour, by touch, with the sheet closed and opened again between steps. The
// box never covers Recentre; on the owner's phone the tour pans Jesus Christ clear of its box in
// step 8, and the pan is undone when the step ends.
test.describe("the tour", () => {
  test.use({ viewport: { width: 325, height: 600 } });

  test("can be finished by touch with the sheet closed and opened between steps, and a step's pan is undone when it ends", async ({ page }) => {
    await page.goto("/");
    await focusIs(page, "person:jesus_905");
    await sheet(page).getByRole("tabpanel", { name: "Details" }).getByRole("button", { name: "Help: take the tour" }).tap();
    const tour = page.getByRole("dialog", { name: "Tour" });
    for (let n = 1; n <= STEPS.length; n++) {
      await expect(tour).toContainText(`Step ${n} of ${STEPS.length}`);
      await recentreInReach(page, 40);
      if (n === 8) await expect.poll(() => offCentre(page)).toBeGreaterThan(10); // the tour panned
      else {
        if (n === 9) await centred(page); // and undid the pan when step 8 ended
        for (let i = 0; i < 2; i++) {
          await handle(page).tap();
          await recentreInReach(page, 40);
        }
      }
      await tour.getByRole("button", { name: "Do it for me" }).tap();
    }
    await expect(tour).toContainText("Done");
    await tour.getByRole("button", { name: "Finish", exact: true }).tap();
    await expect(tour).toBeHidden();
  });
});

// The owner's phone and a larger one, on their side: the sheet docks at the right (decision 184).
for (const size of [{ width: 760, height: 330 }])
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("after a drag, closing and opening the side sheet centres the Focus in the free scene", async ({ page }) => {
      await open(page);
      await moveCamera(page);
      await handle(page).tap(); // closed
      await centred(page);
      await moveCamera(page);
      await handle(page).tap(); // open
      await centred(page);
    });

    test("turning the phone upright and back centres the Focus", async ({ page }) => {
      await open(page);
      await moveCamera(page);
      await page.setViewportSize({ width: size.height, height: size.width });
      await expect(page.locator("html")).not.toHaveAttribute("data-side");
      await centred(page);
      await moveCamera(page);
      await page.setViewportSize(size);
      await expect(page.locator("html")).toHaveAttribute("data-side");
      await centred(page);
    });
  });
