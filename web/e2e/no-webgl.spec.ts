import { expect, test, type Page } from "@playwright/test";
import { openOnAbraham } from "./scene";
import { firstVisit, holdData, splash, start, takeTour } from "./splash";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" }).getByRole("button");
const fallback = (page: Page) => page.getByText("This browser has no WebGL");

// With these flags Chromium cannot create a WebGL context, as on a device without WebGL.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("on a first visit the splash shows, has no tour to take, and Start exploring leaves the panel alone", async ({ page }) => {
  await firstVisit(page);
  await page.goto("/");
  // The tour needs the scene, as the footer's link does: once the page finds no WebGL, no button for it.
  await expect(fallback(page)).toBeVisible();
  await expect(takeTour(page)).toBeHidden();
  await start(page).click();
  await expect(splash(page)).toBeHidden();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Jesus Christ");
});

test("Take the tour, pressed before the page finds no WebGL, ends at the page's own message and the hint", async ({ page }) => {
  const release = await holdData(page);
  await firstVisit(page);
  await page.goto("/");
  await takeTour(page).click();
  await expect(splash(page)).toBeHidden();
  release();
  await expect(fallback(page)).toBeVisible();
  await expect(page.getByText("A click selects a node")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Tour" })).toHaveCount(0);
});

test("the page says so and the panel alone walks the journey", async ({ page }) => {
  await openOnAbraham(page);
  await expect(page.getByText("This browser has no WebGL")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  const box = (await panel(page).boundingBox())!;
  expect(box.width).toBeGreaterThan(page.viewportSize()!.width - 2);

  // A Neighbour list: a double click makes Sarah the Focus.
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).dblclick();
  await expect(bar(page)).toHaveText(["Sarah", "Abraham", "Clear"]);

  // Shared Verses: select Abraham in Sarah's list, then a double click on a Verse they share.
  // Fixture: Gen 16:1 names both.
  await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Abraham/ }).click();
  await panel(page).getByRole("list", { name: /^Together in/ }).getByRole("button", { name: "Gen 16:1" }).dblclick();
  await expect(bar(page)).toHaveText(["Gen 16:1", "Sarah", "Abraham", "Clear"]);

  // Search.
  await page.getByRole("searchbox", { name: "Search" }).fill("Isaac");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await expect(bar(page)).toHaveText(["Isaac", "Gen 16:1", "Sarah", "Abraham", "Clear"]);

  // The Your Path bar selects; Make Focus moves.
  await bar(page).filter({ hasText: "Abraham" }).click();
  await panel(page).getByRole("button", { name: "Make Focus" }).click();
  await expect(bar(page)).toHaveText(["Abraham", "Isaac", "Gen 16:1", "Sarah", "Clear"]);
});

test("the search box, hint, reader panel, panel, notice, and buttons do not overlap", async ({ page }) => {
  await openOnAbraham(page);
  await panel(page).getByRole("button", { name: "Read", exact: true }).click();
  const reader = page.getByRole("region", { name: "Reader" });
  await expect(reader.getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  // A move writes the notice line, which must clear the panel too.
  await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).dblclick();
  await expect(page.getByRole("status")).toHaveText("Sarah is the Focus.");
  const boxes = await Promise.all(
    [
      page.getByRole("search"),
      page.getByText("A click selects a node."),
      reader,
      panel(page),
      page.getByRole("status"),
      page.getByRole("button", { name: "Filters" }),
      page.getByRole("button", { name: "Copy link" }),
    ].map(async (l) => (await l.boundingBox())!),
  );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, JSON.stringify([a, b])).toBe(true);
});
