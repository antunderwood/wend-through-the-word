import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs, nodes } from "./scene";

const ABRAHAM = "person:abraham_58";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const reader = (page: Page) => page.getByRole("region", { name: "Reader" });
const verse = (page: Page, ref: string) => reader(page).getByRole("button", { name: ref, exact: true });

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
});

// Selects a Verse from Abraham's Verse list, then opens the reader panel at it.
async function readFromList(page: Page, ref: string) {
  await panel(page).getByRole("list", { name: /^Verse/ }).getByRole("button", { name: new RegExp(`^${ref}`) }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(ref);
  await panel(page).getByRole("button", { name: "Read", exact: true }).click();
  await expect(reader(page).getByRole("heading", { level: 2 })).toBeVisible();
  // The scene has made way for the panel: two frames, so it has been resized and drawn.
  for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(requestAnimationFrame));
}

test("Read with a Verse selected opens its chapter with that Verse highlighted", async ({ page }) => {
  // Fixture: Gen 11:31 is Abraham's heaviest Verse, so it is in his Ring 1.
  await readFromList(page, "Gen 11:31");
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(reader(page)).toContainText("Berean Standard Bible");
  await expect(verse(page, "Gen 11:31")).toHaveAttribute("aria-current", "true");
  await expect(verse(page, "Gen 11:31")).toBeInViewport();
  await expect(reader(page)).toContainText("When Terah was 70 years old, he became the father of Abram, Nahor, and Haran.");
  // Verses in the scene are marked quietly; Gen 11:1 is not in Abraham's scene.
  await expect(verse(page, "Gen 11:31")).toHaveAccessibleDescription("In the scene");
  await expect(verse(page, "Gen 11:1")).toHaveAccessibleDescription("");
  await expect(reader(page).locator('[aria-current="true"]')).toHaveCount(1);
});

test("Read on an Entity opens the chapter of its first linked Verse", async ({ page }) => {
  await panel(page).getByRole("button", { name: "Read", exact: true }).click();
  // Fixture: Abraham's first Verse in Bible order is Gen 11:26.
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(verse(page, "Gen 11:26")).toBeInViewport();
});

test("a click on a Verse selects it and leaves the scene; a double click makes it the Focus", async ({ page }) => {
  await readFromList(page, "Gen 11:31");
  const before = await nodes(page);
  await verse(page, "Gen 11:27").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  await expect(verse(page, "Gen 11:27")).toHaveAttribute("aria-current", "true");
  expect(await nodes(page)).toEqual(before);
  await verse(page, "Gen 11:26").dblclick();
  await focusIs(page, "01011026");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:26");
  await expect(verse(page, "Gen 11:26")).toHaveAttribute("aria-current", "true");
});

test("previous and next chapter stay within the build", async ({ page }) => {
  await readFromList(page, "Gen 11:31");
  const previous = reader(page).getByRole("button", { name: "Previous chapter" });
  const next = reader(page).getByRole("button", { name: "Next chapter" });
  // The fixture builds Gen 11, 16, 25, 26, 36, Matt 17, 3 John 1.
  await expect(previous).toBeDisabled();
  for (const title of ["Genesis 16", "Genesis 25", "Genesis 26", "Genesis 36", "Matthew 17", "3 John 1"]) {
    await next.click();
    await expect(reader(page).getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(reader(page).getByRole("heading", { name: "Matthew 17" })).toBeVisible();
  // Moving through chapters does not change the selection.
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:31");
});

// Makes a Verse the Focus through the search box.
async function searchVerse(page: Page, ref: string, id: string) {
  await page.getByRole("searchbox", { name: "Search" }).fill(ref);
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await focusIs(page, id);
}

test("a Verse that becomes the Focus opens the reader at its chapter; a click on a Verse only selects it", async ({ page }) => {
  // A click selects: the panel shows the Verse's text, and the reader stays closed.
  await panel(page).getByRole("list", { name: /^Verse/ }).getByRole("button", { name: /^Gen 11:31/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:31");
  await expect(panel(page)).toContainText("Terah took his son Abram, his grandson Lot son of Haran, and his daughter-in-law Sarai");
  await expect(reader(page)).toHaveCount(0);

  await searchVerse(page, "Gen 16:1", "01016001");
  await expect(reader(page).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  await expect(verse(page, "Gen 16:1")).toHaveAttribute("aria-current", "true");
  await expect(panel(page)).toContainText("Now Abram’s wife Sarai had borne him no children, but she had an Egyptian maidservant named Hagar.");
  // The scripture is in the app's sans font (decision 137).
  const family = (l: Locator) => l.evaluate((e) => getComputedStyle(e).fontFamily);
  expect(await family(reader(page).locator(".text"))).toBe(await family(page.locator("body")));
});

test("closing the reader panel lasts until the next Verse becomes the Focus", async ({ page }) => {
  await searchVerse(page, "Gen 16:1", "01016001");
  await page.getByRole("button", { name: "Close reader" }).click();
  await expect(reader(page)).toHaveCount(0);
  // The next Verse Focus opens it again (decision 140).
  await searchVerse(page, "Gen 11:31", "01011031");
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  // So does a reload of an address whose Focus is a Verse (decision 147).
  await page.getByRole("button", { name: "Close reader" }).click();
  await page.reload();
  await focusIs(page, "01011031");
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
});

test("a shared address whose Focus is a Verse opens the reader at its chapter", async ({ page }) => {
  await page.goto("/?focus=01016001");
  await focusIs(page, "01016001");
  await expect(reader(page).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  await expect(verse(page, "Gen 16:1")).toHaveAttribute("aria-current", "true");
  // An Entity Focus leaves it closed.
  await page.goto("/?focus=" + ABRAHAM);
  await focusIs(page, ABRAHAM);
  await expect(reader(page)).toHaveCount(0);
});

test("search results show above the open reader panel", async ({ page }) => {
  await searchVerse(page, "Gen 16:1", "01016001");
  await expect(reader(page)).toHaveCount(1);
  const box = page.getByRole("searchbox", { name: "Search" });
  await box.fill("zzzz");
  const note = page.locator(".search").getByText("No match.");
  // The topmost element at the note's centre is the note itself, not the reader panel.
  const b = (await note.boundingBox())!;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent, [b.x + b.width / 2, b.y + b.height / 2])).toBe("No match.");
});

test("the reader follows the Selected Verse, and a Verse outside the build shows the note without a fetch", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await searchVerse(page, "Gen 16:1", "01016001");
  await expect(reader(page).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  // Gen 16:1 has a Cross-reference to Gal 4:24, outside the fixture build.
  await page.locator(".labels").getByText("Gal 4:24", { exact: true }).click();
  await expect(reader(page).getByRole("heading", { name: "Gal 4:24" })).toBeVisible();
  await expect(reader(page)).toContainText("Gal 4:24 is outside this build (Genesis, Matthew, 3 John only).");
  expect(asked.filter((u) => u.includes("/Gal/"))).toEqual([]);
});

test("the search box, Your Path bar, reader panel, scene, and detail panel do not overlap at 1280 x 800", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await readFromList(page, "Gen 11:31");
  const boxes = await Promise.all(
    [
      page.getByRole("search"),
      page.getByRole("navigation", { name: "Your Path" }),
      reader(page),
      page.getByRole("application"),
      panel(page),
    ].map(async (l) => (await l.boundingBox())!),
  );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, JSON.stringify([a, b])).toBe(true);
  // The Focus and Ring 1 are drawn in the scene, between the panels.
  const scene = boxes[3];
  for (const n of (await nodes(page)).filter((n) => ["focus", "ring1", "overflow"].includes(n.role)))
    expect(n.x >= scene.x && n.x <= scene.x + scene.width, n.id).toBe(true);

  // Closed, the reader panel gives its space back to the scene.
  await page.getByRole("button", { name: "Close reader" }).click();
  await expect(reader(page)).toHaveCount(0);
  expect((await page.getByRole("application").boundingBox())!.x).toBe(0);
});
