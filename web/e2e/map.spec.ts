import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

// The map of the selected Place (#84). Nothing here reaches the network: every request to another
// host than the page's own is recorded, then answered with a blank tile or aborted.
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const map = (page: Page) => panel(page).getByRole("region", { name: "Map" });
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

async function thirdParty(page: Page, answer: "tile" | "abort") {
  const asked: string[] = [];
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => (asked.push(route.request().url()), answer === "tile" ? route.fulfill({ contentType: "image/png", body: TILE }) : route.abort()),
  );
  return asked;
}

test.use({ reducedMotion: "reduce" });

test("a shared link to a Place asks nothing of the tile host until Show map, and the notice comes once a session", async ({ page }) => {
  const asked = await thirdParty(page, "tile");
  // Fixture: Bethlehem has a Wikidata point.
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await expect(panel(page).getByRole("list", { name: "Facts" })).toContainText("Coordinates");
  await expect(panel(page).getByRole("button", { name: "Show map" })).toBeVisible();
  expect(asked).toEqual([]);

  await panel(page).getByRole("button", { name: "Show map" }).click();
  await expect(panel(page).getByText(/tiles come from OpenStreetMap, which sees your address and the area you view/)).toBeVisible();
  expect(asked).toEqual([]);
  await panel(page).getByRole("button", { name: "Continue" }).click();

  await expect(map(page).getByText("Bethlehem", { exact: true })).toBeVisible();
  await expect(map(page).locator(".dot")).toBeVisible();
  await expect(map(page).getByRole("link", { name: "OpenStreetMap" })).toBeVisible();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked.every((u) => u.startsWith("https://tile.openstreetmap.org/"))).toBe(true);
  // The facts stay as they were.
  await expect(panel(page).getByRole("list", { name: "Facts" })).toContainText("Coordinates");

  // Hidden and shown again, and after a reload in the same session: no second notice.
  await panel(page).getByRole("button", { name: "Hide map" }).click();
  await expect(map(page)).toHaveCount(0);
  await page.reload();
  await focusIs(page, "place:bethlehem_218");
  await panel(page).getByRole("button", { name: "Show map" }).click();
  await expect(map(page).getByText("Bethlehem", { exact: true })).toBeVisible();
});

test("a Place with no point and a Node that is not a Place say so, and ask nothing of the tile host", async ({ page }) => {
  const asked = await thirdParty(page, "abort");
  // Fixture: Kadesh's OpenStreetMap point was dropped, with nothing in its place.
  await page.goto("/?focus=place:kadesh_661");
  await focusIs(page, "place:kadesh_661");
  await panel(page).getByRole("button", { name: "Show map" }).click();
  await panel(page).getByRole("button", { name: "Continue" }).click();
  await expect(panel(page).getByText(/^No point for this Place\./)).toBeVisible();

  await panel(page).getByRole("list", { name: /^Theme/ }).getByRole("button").first().click();
  await expect(panel(page).getByText("No Place to show.")).toBeVisible();
  expect(asked).toEqual([]);
});
