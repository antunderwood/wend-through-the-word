import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348",
  ISAAC = "person:isaac_616";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });
const search = (page: Page) => new URL(page.url()).search;
const historyLength = (page: Page) => page.evaluate(() => history.length);
// On the node's label, as in path.spec.ts.
async function doubleClick(page: Page, name: string, id: string) {
  await page.locator(".labels").getByText(name, { exact: true }).dblclick();
  await focusIs(page, id);
}

test.use({ reducedMotion: "reduce" });

test("a shared address opens on its Focus and view; selecting and pinning update it in place", async ({ page }) => {
  await page.goto("/?focus=person:isaac_616&view=B");
  await focusIs(page, ISAAC);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Stacked discs");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  const entries = await historyLength(page);

  await panel(page).getByRole("list", { name: /^Place/ }).getByRole("button", { name: /^Gerar/ }).click();
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
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  expect(search(page)).toBe("");
  await doubleClick(page, "Sarah", SARAH);
  await doubleClick(page, "Hagar", HAGAR);
  await expect.poll(() => search(page)).toBe("?focus=person:hagar_1348");

  await page.goBack();
  await focusIs(page, SARAH);
  expect(search(page)).toBe("?focus=person:sarah_2473");
  await page.goBack();
  await focusIs(page, ABRAHAM);
  expect(search(page)).toBe("");
  await page.goForward();
  await focusIs(page, SARAH);
  await page.goForward();
  await focusIs(page, HAGAR);
});

test("an unknown Focus opens on Abraham with a notice", async ({ page }) => {
  await page.goto("/?focus=person:nobody_1&view=C");
  await focusIs(page, ABRAHAM);
  await expect(page.getByRole("status")).toHaveText("Not recognised in this link, so left out: focus person:nobody_1.");
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Free orbit");
  await expect.poll(() => search(page)).toBe("?view=C");
});

test("Copy link puts the current address on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?focus=person:isaac_616");
  await focusIs(page, ISAAC);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});
