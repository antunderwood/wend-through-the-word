import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

// The map's Journey view (#86): the Places on Your Path that have points, joined in Path order.
// Every request to another host than the page's own is aborted, as when the reader is offline.
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const map = (page: Page) => panel(page).getByRole("region", { name: "Map" });
const view = (page: Page, name: "Place" | "Neighbours" | "Journey") => panel(page).getByRole("group", { name: "Map view" }).getByRole("button", { name });
const label = (page: Page, name: string) => map(page).getByText(name, { exact: true });
const pathBar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });

// Opens the page on this Your Path (oldest first) and Focus, with the tile host unreachable.
async function openOn(page: Page, path: string[], focus: string) {
  await page.addInitScript((j) => localStorage.setItem("wend.journey", j), JSON.stringify({ focus, path }));
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
  await page.goto("/");
  await focusIs(page, focus);
}
async function openMap(page: Page) {
  await panel(page).getByRole("button", { name: "Show map" }).click();
  await panel(page).getByRole("button", { name: "Continue" }).click();
}

// The line's corners, and the centres of the named dots, on the page.
const corners = (page: Page) =>
  map(page)
    .locator("path.journey-line")
    .evaluate((el: SVGPathElement) => {
      const m = el.getScreenCTM()!;
      return [...el.getAttribute("d")!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => {
        const p = new DOMPoint(+x, +y).matrixTransform(m);
        return { x: Math.round(p.x), y: Math.round(p.y) };
      });
    });
async function centres(page: Page, names: string[]) {
  const out = [];
  for (const name of names) {
    const b = (await map(page).locator(".map-place", { has: page.getByText(name, { exact: true }) }).boundingBox())!;
    out.push({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  }
  return out;
}
// The line runs through the named dots' centres, in order. Both are read again each time, as a
// message above the map takes its room and the map is framed again (#87).
const joins = (page: Page, names: string[]) => expect.poll(async () => JSON.stringify(await corners(page)) === JSON.stringify(await centres(page, names))).toBe(true);

test.use({ reducedMotion: "reduce" });

test("Journey joins Your Path's Places that have points in Path order, says what it skipped, and a click on a dot selects that Place", async ({ page }) => {
  // Fixture: Ur, Haran, and Egypt have points; Canaan has none; Abraham is a Person.
  await openOn(page, ["place:ur_1189", "person:abraham_58", "place:haran_527", "place:canaan_272"], "place:egypt_362");
  await openMap(page);
  await view(page, "Journey").click();
  for (const name of ["Ur of the Chaldees", "Haran", "Egypt"]) await expect(label(page, name)).toBeVisible();
  await expect(label(page, "Canaan")).toHaveCount(0);
  await expect(panel(page).getByText("Skipped 1 Person and 1 Place with no point on Your Path.")).toBeVisible();
  await joins(page, ["Ur of the Chaldees", "Haran", "Egypt"]);

  // The Selected Place is ringed among the stops; a click on another selects it, and Journey stays.
  await expect(map(page).locator(".map-place.selected")).toHaveText("Egypt");
  await label(page, "Haran").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Haran");
  await expect.poll(() => new URL(page.url()).search).toContain("sel=place:haran_527");
  await expect(view(page, "Journey")).toHaveAttribute("aria-pressed", "true");
  await expect(map(page).locator(".map-place.selected")).toHaveText("Haran");
  await expect(label(page, "Egypt")).toBeVisible();
});

test("Journey under two Places says so; a Selected Node that is not a Place shows the Journey, else the Focus's Neighbours, else no Place", async ({ page }) => {
  // Fixture: Haran's Ring 1 Places are Ur of the Chaldees, which has a point, and Canaan, which has none.
  await openOn(page, ["place:haran_527"], "person:abraham_58");
  await openMap(page);
  // One Place on Your Path and a Focus that is not a Place: nothing to draw, and no switch.
  await expect(panel(page).getByText("No Place to show.")).toBeVisible();
  await expect(panel(page).getByRole("group", { name: "Map view" })).toHaveCount(0);

  // Haran the Focus: Your Path is Abraham then Haran, one Place, so Journey has nothing to draw.
  await pathBar(page).getByRole("button", { name: "Haran" }).click();
  await panel(page).getByRole("button", { name: "Make Focus" }).click();
  await focusIs(page, "place:haran_527");
  await view(page, "Journey").click();
  await expect(panel(page).getByText("Fewer than two Places on Your Path have points, so there is no Journey to draw.")).toBeVisible();
  await expect(map(page)).toHaveCount(0);

  // Abraham selected: the Focus, Haran, with its Neighbours.
  await pathBar(page).getByRole("button", { name: "Abraham" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await expect(panel(page).getByText("The Focus, Haran, and its Neighbours.")).toBeVisible();
  await expect(map(page).locator(".map-place.selected")).toHaveText("Haran");
  await expect(label(page, "Ur of the Chaldees")).toBeVisible();
  await expect(map(page).locator("path.journey-line")).toHaveCount(0);

  // Ur the Focus: Your Path is Abraham, Haran, Ur, two Places, so Abraham selected shows the Journey.
  await label(page, "Ur of the Chaldees").dblclick();
  await focusIs(page, "place:ur_1189");
  await pathBar(page).getByRole("button", { name: "Abraham" }).click();
  await expect(panel(page).getByText("Skipped 1 Person on Your Path.")).toBeVisible();
  await joins(page, ["Haran", "Ur of the Chaldees"]);
});
