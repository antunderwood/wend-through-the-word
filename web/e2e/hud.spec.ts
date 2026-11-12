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

  // Details, the corner switch, goes back to the full panel.
  await hud(page).getByRole("button", { name: "Details" }).click();
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
  // The Focus has no shared verses with itself: its Verses tab lists its own (decision 223).
  await expect(hud(page).getByRole("tab")).toHaveText(["Overview", "Links", "Verses", "Map", "Note"]);
  await expect(hud(page).getByRole("button", { name: /^In \d+ verses: show all$/ })).toBeVisible();
  await hud(page).getByRole("tab", { name: "Verses" }).click();
  await expect(hud(page).getByRole("heading", { name: /^In \d+ verses$/ })).toBeVisible();
  // Abraham's Verses are in Genesis and Matthew: grouped, the first book open, the rest a tap away (decision 233).
  await expect(hud(page).getByRole("button", { name: /^Old Testament/ })).toHaveAttribute("aria-expanded", "true");
  await expect(hud(page).getByRole("button", { name: /^New Testament/ })).toHaveAttribute("aria-expanded", "false");
  await expect(hud(page).getByRole("listitem")).toHaveCount(20);
  await hud(page).getByRole("button", { name: /^New Testament/ }).click();
  await hud(page).getByRole("button", { name: /^Matthew/ }).click();
  await expect(hud(page).getByRole("listitem").last()).toContainText(/^Matt \d+:\d+/);
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

  // The overview shows one shared Verse, and its link opens the Verses tab.
  await hud(page).getByRole("tab", { name: "Overview" }).click();
  await hud(page).getByRole("button", { name: /^With Abraham in \d+ verses?: show all$/ }).click();
  await expect(hud(page).getByRole("tab", { name: "Verses" })).toHaveAttribute("aria-selected", "true");
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

test("the HUD names the Selected Node's place on Your Path, with steps, for a node on it only", async ({ page }) => {
  await toggle(page).click();
  // Abraham is the Focus and the only step.
  await expect(hud(page).getByText("Your Path 1 of 1")).toBeVisible();
  await expect(hud(page).getByRole("button", { name: "Prev", exact: true })).toBeDisabled();
  await expect(hud(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  // A node that is not on Your Path has no such line.
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.mouse.click(isaac.x, isaac.y);
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  await expect(hud(page).getByText(/^Your Path \d+ of \d+$/)).toHaveCount(0);
  // Made the Focus, he is step 2 of 2, and Prev steps back to Abraham.
  await hud(page).getByRole("button", { name: "Make Focus" }).click();
  await expect(hud(page).getByText("Your Path 2 of 2")).toBeVisible();
  await hud(page).getByRole("button", { name: "Prev", exact: true }).click();
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await expect(hud(page).getByText("Your Path 1 of 2")).toBeVisible();
});

test("the panel and the HUD list the same sections, and share the one chosen (decision 238)", async ({ page }) => {
  const chips = panel(page).getByRole("toolbar", { name: "Sections" });
  await expect(chips.getByRole("button")).toHaveText(["Overview", "Links", "Verses", "Map", "Note"]);
  await expect(chips.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "true");
  // A chip scrolls the panel to its section and marks itself.
  await chips.getByRole("button", { name: "Verses" }).click();
  await expect(chips.getByRole("button", { name: "Verses" })).toHaveAttribute("aria-current", "true");
  await expect(panel(page).getByRole("heading", { name: /^In \d+ verses$/ })).toBeInViewport();
  // The HUD opens at that section, and the corner switch names the other view.
  await toggle(page).click();
  await expect(hud(page).getByRole("tab", { name: "Verses" })).toHaveAttribute("aria-selected", "true");
  await hud(page).getByRole("tab", { name: "Links" }).click();
  await hud(page).getByRole("button", { name: "Details" }).click();
  await expect(hud(page)).toHaveCount(0);
  await expect(chips.getByRole("button", { name: "Links" })).toHaveAttribute("aria-current", "true");
  await expect(panel(page).locator("h3[id^=list-]").first()).toBeInViewport();
});

test("with the HUD showing, Read opens a HUD-styled reader modal, not the drawer, and it closes", async ({ page }) => {
  await toggle(page).click();
  await expect(hud(page)).toBeVisible();
  await hud(page).getByRole("button", { name: "Read", exact: true }).click();
  const reader = page.getByRole("region", { name: "Reader" });
  const modal = page.getByRole("group", { name: "Reader (HUD)" });
  await expect(modal.getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(reader).toBeVisible();
  // The scene keeps its full width: no drawer column, and the HUD stays in view beside it.
  await expect(page.locator(".drawer")).toHaveCount(0);
  await expect(hud(page)).toBeVisible();
  // A Verse tapped in the chapter shows on the HUD.
  await reader.getByRole("button", { name: "Gen 11:27", exact: true }).click();
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  // Esc closes it, and the HUD button back to the panel brings the drawer for the next Read.
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await hud(page).getByRole("button", { name: "Details", exact: true }).click();
  await panel(page).getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.locator(".drawer")).toHaveCount(1);
  await expect(modal).toHaveCount(0);
});
