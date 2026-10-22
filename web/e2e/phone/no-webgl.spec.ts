import { expect, test, type Page } from "@playwright/test";
import { doubleTap } from "../touch";

// A phone without WebGL: no scene, and the lists alone walk the journey by touch.
const details = (page: Page) => page.getByRole("tabpanel", { name: "Details" });
const heading = (page: Page) => details(page).getByRole("heading", { level: 2 });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" }).getByRole("button");

// With these flags Chromium cannot create a WebGL context, as on a device without WebGL.
test.use({ reducedMotion: "reduce", launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

// A double tap on a row's middle, once it is scrolled into view.
async function doubleTapRow(page: Page, row: ReturnType<Page["getByRole"]>) {
  await row.scrollIntoViewIfNeeded();
  const b = (await row.boundingBox())!;
  await doubleTap(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
}

test("without WebGL the lists walk the journey by touch on a phone", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(details(page)).toContainText("This browser has no WebGL, so the graph is not drawn. The lists below work alone: a tap selects, a double tap makes the Focus.");
  await expect(heading(page)).toHaveText("Abraham");
  // There is no scene to show above the sheet: it takes the screen below the Your Path bar and the
  // controls, which stay clear of each other.
  const sheet = (await page.getByRole("region", { name: "Sheet" }).boundingBox())!;
  const path = (await page.getByRole("navigation", { name: "Your Path" }).boundingBox())!;
  const copy = (await page.getByRole("button", { name: "Copy link" }).boundingBox())!;
  expect(sheet.height).toBeGreaterThan(844 * 0.75);
  expect(sheet.y + sheet.height).toBeCloseTo(844, 0);
  expect(path.y + path.height).toBeLessThanOrEqual(copy.y);
  expect(copy.y + copy.height).toBeLessThanOrEqual(sheet.y);

  // A tap on a row selects it; a double tap makes Sarah the Focus.
  const persons = details(page).getByRole("list", { name: /^Person/ });
  await persons.getByRole("button", { name: /^Isaac/ }).tap();
  await expect(heading(page)).toHaveText("Isaac");
  await doubleTapRow(page, persons.getByRole("button", { name: /^Sarah/ }));
  await expect(bar(page)).toHaveText(["Sarah", "Abraham", "Clear"]);
  await expect(heading(page)).toHaveText("Sarah");

  // Search from the button.
  await page.getByRole("button", { name: "Search" }).tap();
  await page.keyboard.type("Isaac");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
  await expect(bar(page)).toHaveText(["Isaac", "Sarah", "Abraham", "Clear"]);

  // Your Path selects; Make Focus moves.
  await bar(page).filter({ hasText: "Abraham" }).tap();
  await expect(heading(page)).toHaveText("Abraham");
  await details(page).getByRole("button", { name: "Make Focus", exact: true }).tap();
  await expect(bar(page)).toHaveText(["Abraham", "Isaac", "Sarah", "Clear"]);
});
