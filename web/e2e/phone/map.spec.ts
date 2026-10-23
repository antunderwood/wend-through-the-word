import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";
import { doubleTap } from "../touch";
import { selectedIs } from "../touch-input";

test.use({ reducedMotion: "reduce" });

// On a phone the map is in the sheet's Details tab (#84). Every request to another host than the
// page's own is aborted, as when the reader is offline: the dot, the name, and the attribution show
// on the plain background.
test("with every tile request aborted, Show map in the Details tab still shows the Place's dot and name", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  const asked: string[] = [];
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => (asked.push(route.request().url()), route.abort()),
  );
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  const details = page.getByRole("region", { name: "Sheet" }).getByRole("tabpanel", { name: "Details" });
  await details.getByRole("button", { name: "Show map" }).tap();
  await details.getByRole("button", { name: "Continue" }).tap();

  const map = details.getByRole("region", { name: "Map" });
  await expect(map.getByText("Bethlehem", { exact: true })).toBeVisible();
  await expect(map.locator(".dot")).toBeVisible();
  await expect(map.getByRole("link", { name: "OpenStreetMap" })).toBeVisible();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
});

// Neighbours on a phone (#85): a tap on a Neighbour's dot selects it, a double tap makes it the Focus.
test("in Neighbours, a tap on a dot selects that Place and a double tap makes it the Focus", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
  // Fixture: Haran's Ring 1 Places are Ur of the Chaldees, which has a point, and Canaan, which has none.
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  const details = page.getByRole("region", { name: "Sheet" }).getByRole("tabpanel", { name: "Details" });
  await details.getByRole("button", { name: "Show map" }).tap();
  await details.getByRole("button", { name: "Continue" }).tap();
  await details.getByRole("group", { name: "Map view" }).getByRole("button", { name: "Neighbours" }).tap();

  const map = details.getByRole("region", { name: "Map" });
  await map.getByText("Ur of the Chaldees", { exact: true }).tap();
  await selectedIs(page, "place:ur_1189");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");

  const haran = map.getByText("Haran", { exact: true });
  await haran.scrollIntoViewIfNeeded();
  const b = (await haran.boundingBox())!;
  await doubleTap(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await focusIs(page, "place:haran_527");
});
