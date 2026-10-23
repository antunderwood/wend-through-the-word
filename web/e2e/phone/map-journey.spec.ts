import { expect, test } from "@playwright/test";
import { openMap, thirdParty } from "../map";
import { focusIs } from "../scene";

test.use({ reducedMotion: "reduce" });

// Journey on a phone (#86), in the sheet's Details tab, with every tile request aborted: the
// Path's Places with points are drawn and joined, and a tap on a dot selects that Place.
test("in Journey, the Path's Places are joined and a tap on a dot selects that Place", async ({ page }) => {
  // Fixture: Ur, Haran, and Egypt have points; Abraham is a Person.
  const journey = JSON.stringify({ focus: "place:egypt_362", path: ["place:ur_1189", "person:abraham_58", "place:haran_527"] });
  await page.addInitScript((j) => (localStorage.setItem("wend.hintDismissed", "1"), localStorage.setItem("wend.journey", j)), journey);
  await thirdParty(page);
  await page.goto("/");
  await focusIs(page, "place:egypt_362");
  const details = page.getByRole("region", { name: "Sheet" }).getByRole("tabpanel", { name: "Details" });
  await openMap(details, true);
  await details.getByRole("group", { name: "Map view" }).getByRole("button", { name: "Journey" }).tap();

  const map = details.getByRole("region", { name: "Map" });
  await expect(details.getByText("Skipped 1 Person on Your Path.")).toBeVisible();
  await expect(map.locator("path.journey-line")).toHaveCount(1);
  await map.getByText("Ur of the Chaldees", { exact: true }).tap();
  await expect.poll(() => new URL(page.url()).search).toContain("sel=place:ur_1189");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
});
