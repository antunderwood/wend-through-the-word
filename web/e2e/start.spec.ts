import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

// The first Focus (decision 186): Jesus Christ, unless the address names a Focus or this browser
// keeps Your Path.
const JESUS = "person:jesus_905",
  GOD = "person:god_1324",
  ABRAHAM = "person:abraham_58";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const search = (page: Page) => new URL(page.url()).search;

test.use({ reducedMotion: "reduce" });

test("a first visit opens on Jesus Christ, with the bare address", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, JESUS);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Jesus Christ");
  await expect(page.locator(".nl.focus")).toContainText("Jesus Christ");
  expect(search(page)).toBe("");
});

test("a kept Your Path wins over Jesus Christ", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, JESUS);
  // Fixture: God is in Jesus Christ's Person list.
  await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^God/ }).dblclick();
  await focusIs(page, GOD);
  await page.goto("/");
  await focusIs(page, GOD);
  await expect(page.getByRole("navigation", { name: "Your Path" }).getByRole("button")).toHaveText(["God", "Jesus Christ", "Clear"]);
});

test("a Focus in the address wins over Jesus Christ", async ({ page }) => {
  await page.goto(`/?focus=${ABRAHAM}`);
  await focusIs(page, ABRAHAM);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
});
