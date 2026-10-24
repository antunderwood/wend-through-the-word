import { expect, test, type Page } from "@playwright/test";
import { doubleClickLabel, focusIs, openOnAbraham } from "./scene";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348",
  ISAAC = "person:isaac_616",
  JESUS = "person:jesus_905";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });
const search = (page: Page) => new URL(page.url()).search;
const historyLength = (page: Page) => page.evaluate(() => history.length);

test.use({ reducedMotion: "reduce" });

test("a shared address opens on its Focus and view; selecting and pinning update it in place", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616&view=B");
  await focusIs(page, ISAAC);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Stacked discs");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  const entries = await historyLength(page);

  await panel(page).getByRole("list", { name: /^Location/ }).getByRole("button", { name: /^Gerar/ }).click();
  await expect.poll(() => search(page)).toBe("?focus=person:isaac_616&sel=place:gerar_459&view=B");
  await panel(page).getByRole("button", { name: "Pin", exact: true }).click();
  await expect.poll(() => search(page)).toBe("?focus=person:isaac_616&sel=place:gerar_459&pins=place:gerar_459&view=B");
  expect(await historyLength(page)).toBe(entries);

  // Opening that address again restores the selection and the pin.
  await page.reload();
  await focusIs(page, ISAAC);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gerar");
  await expect(panel(page).getByRole("button", { name: "Unpin" })).toBeVisible();
});

test("Back and Forward move between Foci", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  expect(search(page)).toBe("?focus=person:abraham_58");
  await doubleClickLabel(page, "Sarah", SARAH);
  await doubleClickLabel(page, "Hagar", HAGAR);
  await expect.poll(() => search(page)).toBe("?focus=person:hagar_1348");

  await page.goBack();
  await focusIs(page, SARAH);
  expect(search(page)).toBe("?focus=person:sarah_2473");
  await page.goBack();
  await focusIs(page, ABRAHAM);
  expect(search(page)).toBe("?focus=person:abraham_58");
  await page.goForward();
  await focusIs(page, SARAH);
  await page.goForward();
  await focusIs(page, HAGAR);
});

test("an unknown Focus opens on the first Focus, Jesus Christ, with a notice", async ({ page }) => {
  await page.goto("/?focus=person:nobody_1&view=C");
  await focusIs(page, JESUS);
  await expect(page.getByRole("status")).toHaveText("Not recognised in this link, so left out: focus person:nobody_1.");
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Free orbit");
  await expect.poll(() => search(page)).toBe("?view=C");
});

test("a Verse number its chapter does not have is left out with a notice, not a failed load", async ({ page }) => {
  // Fixture: Gen 11 is built and ends at verse 32.
  await page.goto("/?focus=01011099&pins=01011033");
  await focusIs(page, JESUS);
  await expect(page.getByRole("status")).toHaveText("Not recognised in this link, so left out: focus 01011099, pins 01011033.");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

// Fixture stand-in: Gen 22 is not built, so Gen 16:1 stands in for the owner's Gen.22.2.
test("a Verse in the address is its OSIS reference, and Copy link gives that form", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?focus=Gen.16.1");
  await focusIs(page, "01016001");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 16:1");
  await expect(page.getByRole("region", { name: "Reader" }).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  expect(search(page)).toBe("?focus=Gen.16.1");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL("/?focus=Gen.16.1", page.url()).href);
});

test("a link written with a Verse Key still opens, and the address then names the Verse its new way", async ({ page }) => {
  await page.goto("/?focus=01016001&pins=01011031");
  await focusIs(page, "01016001");
  await expect(page.getByRole("region", { name: "Reader" }).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  await expect.poll(() => search(page)).toBe("?focus=Gen.16.1&pins=Gen.11.31");
});

test("Copy link puts the current address on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?focus=person:isaac_616");
  await focusIs(page, ISAAC);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test("a copied link names the Focus, even Jesus Christ with default settings", async ({ page, context }) => {
  // The bare address restores this browser's own session, so a shared link never uses it.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await focusIs(page, JESUS);
  expect(search(page)).toBe("");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL("/?focus=person:jesus_905", page.url()).href);
});
