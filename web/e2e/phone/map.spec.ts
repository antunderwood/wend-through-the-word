import { expect, test } from "@playwright/test";
import { focusIs } from "../scene";

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
