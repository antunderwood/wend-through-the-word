import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "../scene";

// A phone turned sideways is 844 x 390: wider than the phone layout's 640 px, so the layout follows
// the new width (docs/specs/mobile.md, story 44) and has the desktop's panel, on a short screen.
const ABRAHAM = "person:abraham_58";
const LANDSCAPE = { width: 844, height: 390 };
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });

test.use({ reducedMotion: "reduce" });

type Box = { name: string; x: number; y: number; width: number; height: number };
const box = async (name: string, l: Locator): Promise<Box> => ({ name, ...(await l.boundingBox())! });
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const overlaps = (boxes: Box[]) => boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.name} and ${b.name}`));

// What lies over the scene in landscape, each with its box.
const floating = (page: Page) =>
  Promise.all([
    box("search", page.getByRole("search")),
    box("Your Path", page.getByRole("navigation", { name: "Your Path" })),
    box("hint", page.getByText("A tap selects a node.")),
    box("notice", page.getByRole("status")),
    box("views", page.getByRole("radiogroup", { name: "View" })),
    box("Filters", page.getByRole("button", { name: "Filters" })),
    box("Copy link", page.getByRole("button", { name: "Copy link" })),
    box("panel", panel(page)),
    box("footer", page.getByRole("contentinfo")),
  ]);

// Each of the Selected Node's actions is whole on screen and nothing lies over its middle.
async function actionsInReach(page: Page) {
  for (const name of ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"]) {
    const button = panel(page).getByRole("button", { name, exact: true });
    await expect(button, name).toBeInViewport({ ratio: 1 });
    const b = (await button.boundingBox())!;
    expect(await button.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 }), name).toBe(true);
  }
}

test("turned sideways, the page keeps its state and has the desktop layout, with nothing over anything else", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await page.getByRole("tabpanel", { name: "Details" }).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).tap();

  await page.setViewportSize(LANDSCAPE);
  await expect(page.getByRole("region", { name: "Sheet" })).toHaveCount(0);
  await focusIs(page, ABRAHAM);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Sarah");
  const boxes = await floating(page);
  expect(overlaps(boxes)).toEqual([]);
  for (const b of boxes) {
    expect(b.x, b.name).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, b.name).toBeLessThanOrEqual(LANDSCAPE.width);
    expect(b.y + b.height, b.name).toBeLessThanOrEqual(LANDSCAPE.height);
  }
  await actionsInReach(page);
  // The scene keeps most of the width beside the panel.
  expect((await page.getByRole("application").boundingBox())!.width).toBeGreaterThan(LANDSCAPE.width / 2);

  // Turned back, the bottom sheet holds the same selection.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tabpanel", { name: "Details" }).getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await focusIs(page, ABRAHAM);
});

test("turned sideways, the reader takes the panel's place, clear of the controls, with room to read", async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await actionsInReach(page);
  await panel(page).getByRole("button", { name: "Read", exact: true }).tap();
  const reader = page.getByRole("region", { name: "Reader" });
  await expect(reader.getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  const boxes = [await box("reader", reader), ...(await floating(page)).filter((b) => b.name !== "panel")];
  expect(overlaps(boxes)).toEqual([]);
  const r = boxes[0];
  // Inside the drawer's padding, at the right and the bottom of the screen.
  expect(r.x + r.width).toBeGreaterThan(LANDSCAPE.width - 20);
  expect(r.y + r.height).toBeGreaterThan(LANDSCAPE.height - 20);
  expect((await page.getByRole("application").boundingBox())!.width).toBeGreaterThan(LANDSCAPE.width / 2);
  // At least four lines of the chapter show.
  expect((await reader.locator(".text").boundingBox())!.height).toBeGreaterThan(4 * 18 * 1.75);
  await reader.getByRole("button", { name: "Close reader" }).tap();
  await expect(reader).toHaveCount(0);
});
