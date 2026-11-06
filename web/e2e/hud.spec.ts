import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "./scene";

const ABRAHAM = "person:abraham_58";
const hud = (page: Page) => page.getByRole("region", { name: "Selected Node HUD" });
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const toggle = (page: Page) => page.getByRole("button", { name: "HUD", exact: true });

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
});

test("the HUD shows the Selected Node over the scene in place of the panel, and the choice is kept", async ({ page }) => {
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(hud(page)).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await expect(hud(page).getByText("Focus", { exact: true })).toBeVisible();
  // The Focus offers no Make Focus; its links are counted by type.
  await expect(hud(page).getByRole("button", { name: "Make Focus" })).toHaveCount(0);
  await expect(hud(page).getByText("Themes")).toBeVisible();
  // The panel slides away and the scene takes the whole width.
  await expect.poll(async () => (await panel(page).boundingBox())!.x).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);

  // A Ring 1 node selected in the scene shows on the HUD.
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.mouse.click(isaac.x, isaac.y);
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  await expect(hud(page).getByRole("button", { name: "Make Focus" })).toBeEnabled();
  // The Relationship names the Focus once ("son of Abraham"), not again after a slash.
  await expect(hud(page).locator(".rel")).toHaveText(/son of Abraham$/);

  await page.reload();
  await expect(hud(page)).toBeVisible();

  // Panel goes back to the full panel.
  await hud(page).getByRole("button", { name: "Panel" }).click();
  await expect(hud(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await panel(page).boundingBox())!.x).toBeLessThan(page.viewportSize()!.width - 300);
});

test("Make Focus on the HUD moves the Focus", async ({ page }) => {
  await toggle(page).click();
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.mouse.click(isaac.x, isaac.y);
  await hud(page).getByRole("button", { name: "Make Focus" }).click();
  await focusIs(page, "person:isaac_616");
  await expect(hud(page).getByText("Focus", { exact: true })).toBeVisible();
});

test("the HUD moves by its strip and its grip, sizes by its corner, and keeps both", async ({ page }) => {
  await toggle(page).click();
  const before = (await hud(page).boundingBox())!;
  const strip = hud(page).locator("header");
  const s = (await strip.boundingBox())!;
  await page.mouse.move(s.x + 120, s.y + 8);
  await page.mouse.down();
  await page.mouse.move(s.x - 480, s.y + 108, { steps: 5 });
  await page.mouse.up();
  const moved = (await hud(page).boundingBox())!;
  expect(Math.round(moved.x - before.x)).toBe(-600);
  expect(Math.round(moved.y - before.y)).toBe(100);

  await hud(page).getByRole("button", { name: "Move HUD" }).press("ArrowRight");
  expect(Math.round((await hud(page).boundingBox())!.x - moved.x)).toBe(16);

  const corner = (await hud(page).getByRole("button", { name: "Resize HUD" }).boundingBox())!;
  await page.mouse.move(corner.x + 9, corner.y + 9);
  await page.mouse.down();
  await page.mouse.move(corner.x - 31, corner.y - 31, { steps: 5 });
  await page.mouse.up();
  const sized = (await hud(page).boundingBox())!;
  expect(Math.round(sized.width)).toBe(Math.round(before.width) - 40);
  // A card moved low is cut to the screen, so its corner stays in reach.
  expect(sized.y + sized.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  await page.reload();
  const kept = (await hud(page).boundingBox())!;
  expect(Math.round(kept.x)).toBe(Math.round(moved.x) + 16);
  expect(Math.round(kept.width)).toBe(Math.round(before.width) - 40);
  expect(Math.round(kept.height)).toBe(Math.round(sized.height));

  await hud(page).getByRole("button", { name: "Reset HUD position" }).click();
  expect((await hud(page).boundingBox())!).toEqual(before);
});

test("the HUD's tabs list the links, the shared verses, and the note", async ({ page }) => {
  await toggle(page).click();
  // The Focus has no shared verses with itself, but a note and a route (Map).
  await expect(hud(page).getByRole("tab")).toHaveText(["Overview", "Links", "Map", "Note"]);
  await hud(page).getByRole("tab", { name: "Links" }).click();
  await expect(hud(page).getByRole("list", { name: /^People \d/ })).toBeVisible();
  await hud(page).getByRole("searchbox", { name: "Filter links" }).fill("isaac");
  await expect(hud(page).getByRole("button", { name: /^Isaac/ })).toBeVisible();
  // The name and the reason it is listed are separate words, not run together ("Isaacson of Abraham").
  await expect(hud(page).getByRole("button", { name: /^Isaac \S/ }).first()).toBeVisible();
  // A click in the list selects, and the tab stays.
  await hud(page).getByRole("button", { name: /^Isaac/ }).first().click();
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  await expect(hud(page).getByRole("tab", { name: "Links" })).toHaveAttribute("aria-selected", "true");

  await hud(page).getByRole("tab", { name: "Together" }).click();
  await expect(hud(page).getByRole("heading", { name: /^With Abraham in \d+ verses?$/ })).toBeVisible();

  await hud(page).getByRole("button", { name: "Make Focus" }).click();
  await focusIs(page, "person:isaac_616");
  await hud(page).getByRole("tab", { name: "Note" }).click();
  await hud(page).getByRole("textbox", { name: "Note on Isaac" }).fill("Son of the promise");
  await page.reload();
  await hud(page).getByRole("tab", { name: "Note" }).click();
  await expect(hud(page).getByRole("textbox", { name: /^Note on Isaac/ })).toHaveValue("Son of the promise");
});

test("the flicker is kept, and never runs with animation off", async ({ page }) => {
  await toggle(page).click();
  const flicker = hud(page).getByRole("button", { name: "Flicker" });
  await expect(flicker).toHaveAttribute("aria-pressed", "false");
  await flicker.click();
  await expect(flicker).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(hud(page).getByRole("button", { name: "Flicker" })).toHaveAttribute("aria-pressed", "true");
  // reducedMotion "reduce" is on for these specs: nothing animates.
  expect(await hud(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
