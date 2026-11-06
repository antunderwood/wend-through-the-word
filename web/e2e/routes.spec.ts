import { expect, test, type Page } from "@playwright/test";
import { openMap as open, thirdParty } from "./map";
import { focusIs } from "./scene";

// UBS Bible Routes on the map (decision 220). Fixture: Hagar's route, Gen 16:6 to 14, is listed on
// Hagar, a Person with no point, and on Shur, a Place. Nothing here reaches the network.
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const map = (page: Page) => panel(page).getByRole("region", { name: "Map" });
const menu = (page: Page) => panel(page).getByRole("combobox", { name: "Bible route" });

test.use({ reducedMotion: "reduce" });

test("a Person's route is chosen from the map's menu, drawn dashed, and credited to UBS", async ({ page }) => {
  await thirdParty(page, "tile");
  await page.goto("/?focus=person:hagar_1348");
  await focusIs(page, "person:hagar_1348");
  await open(panel(page));
  await expect(menu(page)).toHaveValue("");
  await menu(page).selectOption({ label: "Hagar flees towards Shur" });
  await expect(map(page).locator("path.route-line")).toBeVisible();
  await expect(panel(page).getByText("Hagar flees towards Shur, Genesis 16:6 to 14. Route © United Bible Societies (CC BY-SA 4.0).")).toBeVisible();
  await menu(page).selectOption({ label: "No route" });
  await expect(map(page).locator("path.route-line")).toHaveCount(0);
});

test("a node with no route has no menu", async ({ page }) => {
  await thirdParty(page, "tile");
  // Fixture: Bethlehem is in no fixture route's passage.
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await open(panel(page));
  await expect(map(page).locator(".dot")).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
});

test("in the HUD a node with a route has a Map tab with the route menu; one without has none", async ({ page }) => {
  await thirdParty(page, "tile");
  await page.addInitScript(() => localStorage.setItem("wend.infoMode", "hud"));
  await page.goto("/?focus=person:hagar_1348");
  await focusIs(page, "person:hagar_1348");
  const hud = page.getByRole("region", { name: "Selected Node HUD" });
  await hud.getByRole("tab", { name: "Map" }).click();
  await open(hud);
  await hud.getByRole("combobox", { name: "Bible route" }).selectOption({ label: "Hagar flees towards Shur" });
  await expect(hud.getByRole("region", { name: "Map" }).locator("path.route-line")).toBeVisible();
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await expect(hud.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(hud.getByRole("tab", { name: "Map" })).toHaveCount(0);
});

test("an unsure route is marked in the menu and its caption", async ({ page }) => {
  await thirdParty(page, "tile");
  await page.goto("/?focus=place:beersheba_170");
  await focusIs(page, "place:beersheba_170");
  await open(panel(page));
  await menu(page).selectOption({ label: "Isaac to Beersheba (a guess) (unsure)" });
  await expect(panel(page).getByText("Unsure: this route's passage has not been checked.")).toBeVisible();
});
