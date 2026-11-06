import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "./scene";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const grip = (page: Page) => page.getByRole("separator", { name: "Resize the panel" });

test.use({ reducedMotion: "reduce" });

test("the panel is resized by dragging its edge or with the arrow keys, and the width is kept", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const width = async () => (await panel(page).boundingBox())!.width;
  expect(await width()).toBeCloseTo(340, 0);

  const box = (await grip(page).boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x - 95, box.y + 200, { steps: 4 });
  await page.mouse.up();
  expect(await width()).toBeCloseTo(440, 0);

  await grip(page).focus();
  await page.keyboard.press("ArrowRight");
  expect(await width()).toBeCloseTo(416, 0);
  await page.keyboard.press("End");
  expect(await width()).toBeCloseTo(720, 0);
  await page.keyboard.press("Home");
  expect(await width()).toBeCloseTo(280, 0);

  await page.keyboard.press("ArrowLeft");
  await page.reload();
  expect(await width()).toBeCloseTo(304, 0);
  await grip(page).dblclick();
  expect(await width()).toBeCloseTo(340, 0);
});

test("a list of verses has a key saying which node is which, and which are not marked", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const key = panel(page).getByLabel("Key to the marks in the verses");
  // The Focus's own list names it; Isaac shares verses with it, both names in the key.
  await expect(key.first()).toContainText("Abraham");
  await panel(page).getByRole("button", { name: /^Isaac/ }).first().click();
  await expect(key.first()).toContainText("IsaacAbraham");
  // A Theme is found by no name in the text, and the key says so.
  await panel(page).getByRole("button", { name: /^Genealogy 8 verses/ }).click();
  await expect(panel(page).getByText(/GENEALOGY is not marked/)).toBeVisible();
});
