import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "../scene";

const ABRAHAM = "person:abraham_58";

test.use({ reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });

type Box = { name: string; x: number; y: number; width: number; height: number };
async function box(name: string, l: Locator): Promise<Box> {
  return { name, ...(await l.boundingBox())! };
}
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// What floats over the scene: the bars at the top, the first-use hint, the notice, the controls, and
// the sheet, each with its box.
async function floating(page: Page) {
  const sheet = page.getByRole("region", { name: "Sheet" });
  return Promise.all([
    box("Your Path", page.getByRole("navigation", { name: "Your Path" })),
    box("Search", page.getByRole("button", { name: "Search" })),
    box("hint", page.getByText("A click selects a node.")),
    box("notice", page.getByRole("status")),
    box("Tilted plane", page.getByRole("radio", { name: "Tilted plane" })),
    box("Free orbit", page.getByRole("radio", { name: "Free orbit" })),
    box("Filters", page.getByRole("button", { name: "Filters" })),
    box("Copy link", page.getByRole("button", { name: "Copy link" })),
    box("sheet", sheet.getByRole("button", { name: /the sheet$/ })),
  ]);
}

test("on a phone nothing floating over the scene overlaps, every control is in view, and each is large enough to tap", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await page.getByRole("button", { name: "Copy link" }).tap();
  await expect(page.getByRole("status")).toHaveText("Link copied.");

  for (const open of [true, false]) {
    if (!open) await page.getByRole("button", { name: "Close the sheet" }).tap();
    const boxes = await floating(page);
    const overlaps = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.name} and ${b.name}`));
    expect(overlaps).toEqual([]);
    for (const b of boxes) {
      expect(b.x, b.name).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, b.name).toBeLessThanOrEqual(390);
      expect(b.y + b.height, b.name).toBeLessThanOrEqual(844);
    }
    for (const b of boxes.filter((b) => !["hint", "notice", "Your Path"].includes(b.name))) expect(b.height, b.name).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole("button", { name: "Dismiss hint" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("on a phone the tour, the credits, and the data version are at the end of the Details tab", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  const details = page.getByRole("tabpanel", { name: "Details" });
  const credits = details.getByRole("link", { name: "About and credits" });
  await credits.scrollIntoViewIfNeeded();
  await expect(credits).toBeInViewport();
  expect((await credits.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(details).toContainText("Data: CC BY-SA 4.0. Data version");
  await details.getByRole("button", { name: "Help: take the tour" }).tap();
  await expect(page.getByRole("dialog", { name: /tour/i })).toBeVisible();
});
