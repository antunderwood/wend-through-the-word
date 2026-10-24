import { expect, test, type Page } from "@playwright/test";
import { doubleClickLabel, focusIs, nodes, openOnAbraham } from "./scene";

const ABRAHAM = "person:abraham_58";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
// One type's list in the panel, found by its title ("Theme (37)").
const typeList = (page: Page, title: string) => panel(page).getByRole("list", { name: title });

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
});

test("a type's N more opens and closes its full list", async ({ page }) => {
  // Fixture: Abraham has 37 Themes, 6 in Ring 1 and 31 behind the Overflow Node.
  const themes = typeList(page, "Theme (37)");
  await expect(themes.getByRole("listitem")).toHaveCount(6);
  const more = panel(page).getByRole("button", { name: "31 more" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  // A quiet panel button, not a default blue underlined link.
  const look = await more.evaluate((b) => getComputedStyle(b));
  expect(look.color).not.toBe("rgb(0, 0, 238)");
  expect(look.textDecorationLine).toBe("none");

  await more.click();
  await expect(themes.getByRole("listitem")).toHaveCount(37);
  const less = panel(page).getByRole("button", { name: "Show top 6" });
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await less.click();
  await expect(themes.getByRole("listitem")).toHaveCount(6);
});

test("an Overflow Node opens its type's full list and never changes the scene", async ({ page }) => {
  const before = await nodes(page);
  const overflow = before.find((n) => n.id === "overflow:theme")!;
  await page.mouse.click(overflow.x, overflow.y);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("+31 themes");
  await expect(typeList(page, "Theme (37)").getByRole("listitem")).toHaveCount(37);
  expect(await nodes(page)).toEqual(before);
  // Nor does a double click: an Overflow Node cannot be the Focus.
  await page.mouse.dblclick(overflow.x, overflow.y);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("+31 themes");
  expect(await nodes(page)).toEqual(before);
});

// Decision 200: a Place is shown to the reader as a Location, in the singular and the plural.
test("a Place's list is headed Location and its Overflow Node counts locations, one in the singular", async ({ page }) => {
  await expect(typeList(page, "Location (6)").getByRole("listitem")).toHaveCount(6);
  // Fixture: Isaac has one Place behind the Overflow Node.
  await doubleClickLabel(page, "Isaac", "person:isaac_616");
  const overflow = (await nodes(page)).find((n) => n.id === "overflow:place")!;
  await page.mouse.click(overflow.x, overflow.y);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("+1 location");
  await expect(page.locator(".labels").getByText("+1 location", { exact: true })).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: /^Location \(\d+\)$/ })).toBeVisible();
});

test("a list click selects, a double click makes the Focus", async ({ page }) => {
  const before = await nodes(page);
  const people = typeList(page, "Person (24)");
  await people.getByRole("button", { name: /^Isaac/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  expect(await nodes(page)).toEqual(before);
  // The list stays Abraham's, so the second click of a double click lands on the same item.
  await people.getByRole("button", { name: /^Sarah/ }).dblclick();
  await focusIs(page, "person:sarah_2473");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Sarah");
});

test("the panel lists the Verses a Selected Node shares with the Focus, with BSB text", async ({ page }) => {
  await typeList(page, "Theme (37)").getByRole("button", { name: /^Genealogy/ }).click();
  // Genealogy stands in for Faith, which shares no Verse with Abraham in the fixture.
  const verses = panel(page).getByRole("list", { name: "Together in 8 verses" });
  await expect(verses.getByRole("listitem")).toHaveCount(8);
  await expect(verses.getByRole("listitem").first()).toContainText("Gen 11:26");
  await expect(verses.getByRole("listitem").first()).toContainText("When Terah was 70 years old, he became the father of Abram, Nahor, and Haran.");
  // A shared Verse is selected by a click, and the list stays for a double click.
  await verses.getByRole("button", { name: /^Gen 11:27/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  await verses.getByRole("button", { name: /^Gen 11:27/ }).dblclick();
  await focusIs(page, "01011027");
});

test("the chevron collapses and expands the panel and points the way it will move", async ({ page }) => {
  const chevron = page.getByRole("button", { name: "Hide panel" });
  await expect(chevron).toHaveAttribute("aria-expanded", "true");
  await expect(chevron).toHaveText("›");
  await chevron.click();
  await expect(panel(page)).not.toBeInViewport();
  const show = page.getByRole("button", { name: "Show panel" });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await expect(show).toHaveText("‹");
  await show.click();
  await expect(panel(page)).toBeInViewport();
});

test("the panel, open or collapsed, leaves the Your Path bar fully usable", async ({ page }) => {
  await typeList(page, "Person (24)").getByRole("button", { name: /^Sarah/ }).dblclick();
  await focusIs(page, "person:sarah_2473");
  const bar = page.getByRole("navigation", { name: "Your Path" });
  // A click fails if anything lies over its target, so each click checks the bar is uncovered.
  await bar.getByRole("button", { name: "Abraham" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await page.getByRole("button", { name: "Hide panel" }).click();
  await expect(panel(page)).not.toBeInViewport();
  await bar.getByRole("button", { name: "Sarah" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await bar.getByRole("button", { name: "Clear" }).click();
  await expect(bar.getByRole("listitem")).toHaveText(["Sarah"]);
  await bar.getByRole("button", { name: "Undo clear" }).click();
  await expect(bar.getByRole("listitem")).toHaveText(["Sarah", "Abraham"]);
});
