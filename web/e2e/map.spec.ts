import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";
import { selectedIs } from "./touch-input";

// The map of the selected Place (#84) and its Neighbours (#85). Nothing here reaches the network: every request to another
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

// Opens the map, past the notice the first time in a session.
async function openMap(page: Page) {
  await panel(page).getByRole("button", { name: "Show map" }).click();
  const go = panel(page).getByRole("button", { name: "Continue" });
  if (await go.isVisible()) await go.click();
}
const view = (page: Page, name: "Place" | "Neighbours") => panel(page).getByRole("group", { name: "Map view" }).getByRole("button", { name });
const label = (page: Page, name: string) => map(page).getByText(name, { exact: true });
// Where on the page the selected Place's dot is.
const selectedDot = async (page: Page) => (await map(page).locator(".map-place.selected .dot").boundingBox())!;

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

test("Neighbours shows the selected Place's Ring 1 Places that have points; a click on a dot selects it and a double click makes it the Focus", async ({ page }) => {
  await thirdParty(page, "tile");
  // Fixture: Haran's Ring 1 Places are Ur of the Chaldees, which has a point, and Canaan, which has none.
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await expect(view(page, "Place")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Haran")).toBeVisible();
  await expect(label(page, "Ur of the Chaldees")).toHaveCount(0);
  await view(page, "Neighbours").click();
  await expect(label(page, "Ur of the Chaldees")).toBeVisible();
  await expect(map(page).locator(".map-place.selected")).toHaveText("Haran");
  await expect(label(page, "Canaan")).toHaveCount(0);

  // A click selects, as a click on a node does: the panel, the address, and the scene follow, and
  // the map shows Ur's own Neighbours, Haran among them.
  await label(page, "Ur of the Chaldees").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
  await expect.poll(() => new URL(page.url()).search).toContain("sel=place:ur_1189");
  await selectedIs(page, "place:ur_1189");
  await expect(map(page).locator(".map-place.selected")).toHaveText("Ur of the Chaldees");
  await expect(view(page, "Neighbours")).toHaveAttribute("aria-pressed", "true");

  await label(page, "Haran").dblclick();
  await focusIs(page, "place:haran_527");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Haran");

  // The view is kept for the session, after a reload too.
  await page.reload();
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await expect(view(page, "Neighbours")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Ur of the Chaldees")).toBeVisible();
});

test("the open map is a block of its own below the Selected Node's section, and the lists below keep their place whatever it shows", async ({ page }) => {
  await thirdParty(page, "abort");
  // Fixture: Haran has a point; Terah is a Person; Canaan is a Place with none.
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await expect(label(page, "Haran")).toBeVisible();
  const section = (await panel(page).locator("section.selected").boundingBox())!;
  const m = (await map(page).boundingBox())!;
  expect(m.y).toBeGreaterThanOrEqual(section.y + section.height);
  expect(m.height).toBeGreaterThanOrEqual(280);

  // A click in a list changes what the block shows (a Person, then a Place with no point); the
  // lists stay where they were, so the second click of a double click lands where the first did.
  const people = panel(page).getByRole("list", { name: /^Person/ });
  const places = panel(page).getByRole("list", { name: /^Place/ });
  // Where each list lies in the panel, however far the panel is scrolled.
  const at = async () => [await people.evaluate((e: HTMLElement) => e.offsetTop), await places.evaluate((e: HTMLElement) => e.offsetTop)];
  const before = await at();
  await people.getByRole("button", { name: /^Terah/ }).click();
  await expect(panel(page).getByText("No Place to show.")).toBeVisible();
  expect(await at()).toEqual(before);
  await places.getByRole("button", { name: /^Canaan/ }).click();
  await expect(panel(page).getByText(/^No point for this Place\./)).toBeVisible();
  expect(await at()).toEqual(before);
});

test("Tab reaches the view switch, every dot, and Recentre map; Enter on a dot selects at once; a text list names the Places shown; reduced motion re-frames in one step", async ({ page }) => {
  await thirdParty(page, "abort");
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await view(page, "Neighbours").focus();
  await page.keyboard.press("Enter");
  await expect(view(page, "Neighbours")).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByRole("list", { name: "Shown on the map" }).getByRole("listitem")).toHaveText(["Haran (selected)", "Ur of the Chaldees"]);

  // From Hide map, Tab reaches Recentre map, the switch, and both dots.
  await panel(page).getByRole("button", { name: "Hide map" }).focus();
  const reached: string[] = [];
  while (!reached.includes("Ur of the Chaldees") && reached.length < 12) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => document.activeElement!.textContent!.trim()));
  }
  expect(reached).toEqual(expect.arrayContaining(["Recentre map", "Place", "Neighbours", "Haran", "Ur of the Chaldees"]));

  // Enter selects without the pointer's wait for a second click, and the keyboard stays on the dot.
  const ur = map(page).getByRole("button", { name: "Ur of the Chaldees" });
  await ur.focus();
  const pressed = Date.now();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
  expect(Date.now() - pressed).toBeLessThan(400);
  await expect(ur).toBeFocused();

  // With reduced motion, Recentre map puts the map back at once, with no glide.
  await map(page).scrollIntoViewIfNeeded();
  const framed = await selectedDot(page);
  const box = (await map(page).boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height - 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await selectedDot(page)).x - framed.x).toBeGreaterThan(30);
  await panel(page).getByRole("button", { name: "Recentre map" }).focus();
  await page.keyboard.press("Enter");
  expect(Math.abs((await selectedDot(page)).x - framed.x)).toBeLessThan(2);
});

test("two Places at one point both show and each can be selected; after a pan, Recentre map and a new selection frame the map again", async ({ page }) => {
  await thirdParty(page, "abort");
  // Fixture: Bethlehem's Ring 1 Places, Judea and Jerusalem, share one point.
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await openMap(page);
  await view(page, "Neighbours").click();
  await expect(label(page, "Judea")).toBeVisible();
  await expect(label(page, "Jerusalem")).toBeVisible();

  await map(page).scrollIntoViewIfNeeded();
  const framed = await selectedDot(page);
  const box = (await map(page).boundingBox())!;
  const pan = async () => {
    await page.mouse.move(box.x + 30, box.y + box.height - 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await selectedDot(page)).x - framed.x).toBeGreaterThan(30);
  };
  await pan();
  await panel(page).getByRole("button", { name: "Recentre map" }).click();
  await expect.poll(async () => Math.abs((await selectedDot(page)).x - framed.x)).toBeLessThan(2);

  // The second name at the shared point selects; Jerusalem's Neighbours are Judea, at its own point,
  // and Bethlehem. Selecting Bethlehem again frames the map as before the pan.
  await pan();
  await label(page, "Jerusalem").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Jerusalem");
  await label(page, "Bethlehem").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Bethlehem");
  await expect.poll(async () => Math.abs((await selectedDot(page)).x - framed.x)).toBeLessThan(2);
  // The first name at the shared point selects too.
  await label(page, "Judea").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Judea");
});
