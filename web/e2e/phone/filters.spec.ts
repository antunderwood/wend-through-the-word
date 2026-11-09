import { expect, test, type Page } from "@playwright/test";
import { openSheet, openView } from "../touch";
import { focusIs, openOnAbraham, themesOnScreen } from "../scene";

const ABRAHAM = "person:abraham_58";
const details = (page: Page) => page.getByRole("tabpanel", { name: "Details" });

test.use({ reducedMotion: "reduce" });

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await openSheet(page);
}

test("the filters in the View popover hide a node type and change the Vote Limit, with the explanation shown", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  const filters = (await openView(page)).getByRole("group", { name: "Filters" });
  await filters.scrollIntoViewIfNeeded();
  await expect(filters).toBeInViewport();
  // The filters are a section of the View popover, not a popover of their own.
  await expect(page.getByRole("dialog", { name: "Filters" })).toHaveCount(0);

  expect(await themesOnScreen(page)).toBeGreaterThan(0);
  await filters.getByRole("checkbox", { name: "Themes" }).tap();
  await expect.poll(() => themesOnScreen(page)).toBe(0);
  await expect.poll(() => new URL(page.url()).search).toBe("?focus=person:abraham_58&hide=theme");

  await expect(filters).toContainText("Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength.");
  await expect(filters).toContainText("With an Entity as the Focus, the slider only changes Ring 2.");
  await filters.getByRole("slider", { name: /^Vote Limit/ }).fill("5");
  await expect(filters).toContainText("Vote Limit: 5");
  await expect.poll(() => new URL(page.url()).searchParams.get("votes")).toBe("5");
});

test("the Details tab is about the Selected Node: the scene's settings are in the View popover, which closes on a tap outside", async ({ page }) => {
  await open(page);
  await expect(details(page).getByRole("group", { name: "Filters" })).toHaveCount(0);
  await expect(details(page).getByRole("group", { name: "Key" })).toHaveCount(0);
  await expect(details(page).getByRole("button", { name: "Copy link" })).toHaveCount(0);
  await expect(details(page).getByRole("radiogroup", { name: "View" })).toHaveCount(0);
  const menu = await openView(page);
  await expect(menu.getByRole("group", { name: "Key" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Copy link" })).toBeVisible();
  await page.mouse.click(380, 20); // the top bar, clear of the popover
  await expect(menu).toBeHidden();
});

test("a long list in the Details tab has a filter box that fits the screen and narrows the list", async ({ page }) => {
  await open(page);
  const box = details(page).getByRole("searchbox", { name: "Filter Person" });
  await box.scrollIntoViewIfNeeded();
  const at = (await box.boundingBox())!;
  expect(at.x).toBeGreaterThanOrEqual(0);
  expect(at.x + at.width).toBeLessThanOrEqual(390);
  await box.fill("Isaac");
  await expect(details(page).getByRole("list", { name: /^Person \(\d+ of 24\)$/ })).toContainText("Isaac");
  await details(page).getByRole("button", { name: "Clear filter Person" }).tap();
  await expect(box).toHaveValue("");
});

test("the filter box sits inside the Details section, Escape clears it, and focusing it does not move the section", async ({ page }) => {
  await open(page);
  const sheet = page.getByRole("region", { name: "Sheet" });
  const box = details(page).getByRole("searchbox", { name: "Filter Person" });
  await box.scrollIntoViewIfNeeded();
  const s = (await sheet.boundingBox())!;
  const at = (await box.boundingBox())!;
  expect(at.y).toBeGreaterThanOrEqual(s.y);
  expect(at.y + at.height).toBeLessThanOrEqual(s.y + s.height);
  await box.tap();
  await box.fill("Isaac");
  expect((await sheet.boundingBox())!).toEqual(s);
  await box.press("Escape");
  await expect(box).toHaveValue("");
  await expect(details(page).getByRole("heading", { name: "Person (24)" })).toBeVisible();
});
