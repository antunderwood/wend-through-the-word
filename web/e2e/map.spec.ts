import { expect, test, type Page } from "@playwright/test";
import { attribution, BUILT_TILES, lines, onTileHost, openMap as open, pan, providerLink, selectedDot, thirdParty } from "./map";
import { focusIs } from "./scene";
import { selectedIs } from "./touch-input";

// The map of the selected Place (#84) and its Neighbours (#85). Nothing here reaches the network
// (thirdParty in ./map).
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const map = (page: Page) => panel(page).getByRole("region", { name: "Map" });
const openMap = (page: Page) => open(panel(page));
const view = (page: Page, name: "Location" | "Neighbours") => panel(page).getByRole("group", { name: "Map view" }).getByRole("button", { name });
const label = (page: Page, name: string) => map(page).getByText(name, { exact: true });

test.use({ reducedMotion: "reduce" });

test("a shared link to a Place asks nothing of the tile host until Show map, and the notice comes once a session", async ({ page }) => {
  const asked = await thirdParty(page, "tile");
  // Fixture: Bethlehem has a Wikidata point.
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await expect(panel(page).getByRole("list", { name: "Facts" })).toContainText("Coordinates");
  await expect(panel(page).getByRole("button", { name: "Show map" })).toBeVisible();
  expect(asked).toEqual([]);

  // The notice is announced; Cancel and Continue leave the keyboard on the button that asked.
  const notice = panel(page).getByRole("status").filter({ hasText: `tiles come from ${BUILT_TILES.name}, which sees your address and the area you view` });
  await panel(page).getByRole("button", { name: "Show map" }).click();
  await expect(notice).toBeVisible();
  await panel(page).getByRole("button", { name: "Cancel" }).click();
  await expect(notice).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "Show map" })).toBeFocused();
  await panel(page).getByRole("button", { name: "Show map" }).click();
  expect(asked).toEqual([]);
  await panel(page).getByRole("button", { name: "Continue" }).click();
  await expect(panel(page).getByRole("button", { name: "Hide map" })).toBeFocused();

  await expect(map(page).getByText("Bethlehem", { exact: true })).toBeVisible();
  await expect(map(page).locator(".dot")).toBeVisible();
  await expect(providerLink(map(page))).toBeVisible();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked.every(onTileHost)).toBe(true);
  // The attribution is one line. Esri's sources are cut short, and their button shows them all and
  // hides them again (decision 199).
  const credit = attribution(map(page));
  expect(await lines(credit)).toBe(1);
  if (BUILT_TILES.name === "Esri") {
    const sources = credit.getByRole("button", { name: /^Sources: Esri, .* and the GIS User Community$/ });
    await sources.click();
    await expect(sources).toHaveAttribute("aria-expanded", "true");
    expect(await lines(credit)).toBeGreaterThan(1);
    await sources.click();
    await expect(sources).toHaveAttribute("aria-expanded", "false");
    expect(await lines(credit)).toBe(1);
  }
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

test("a Place with no point says so and asks nothing of the tile host; a Node that is not a Place then shows the Focus's Neighbours", async ({ page }) => {
  const asked = await thirdParty(page);
  // Fixture: Kadesh's OpenStreetMap point was dropped, with nothing in its place.
  await page.goto("/?focus=place:kadesh_661");
  await focusIs(page, "place:kadesh_661");
  await openMap(page);
  await expect(panel(page).getByText(/^No point for this Location\./)).toBeVisible();
  expect(asked).toEqual([]);

  // Your Path has one Place, so a Theme selected shows the Focus's Neighbours (#86); "No Location to
  // show." is in map-journey.spec.ts.
  await panel(page).getByRole("list", { name: /^Theme/ }).getByRole("button").first().click();
  await expect(panel(page).getByText("The Focus, Kadesh, and its Neighbours.")).toBeVisible();
});

test("Neighbours shows the selected Place's Ring 1 Places that have points; a click on a dot selects it and a double click makes it the Focus", async ({ page }) => {
  await thirdParty(page, "tile");
  // Fixture: Haran's Ring 1 Places are Ur of the Chaldees, which has a point, and Canaan, which has none.
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await expect(view(page, "Location")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Haran")).toBeVisible();
  await expect(label(page, "Ur of the Chaldees")).toHaveCount(0);
  await view(page, "Neighbours").click();
  await expect(label(page, "Ur of the Chaldees")).toBeVisible();
  await expect(map(page).locator(".map-place.selected")).toHaveText("Haran");
  await expect(label(page, "Canaan")).toHaveCount(0);

  // A click selects, as a click on a node does: the panel, the address, and the scene follow, and
  // the map shows Ur's own Neighbours, Haran among them. The map stays where it was on screen,
  // though the header and the details above it change (decision 201).
  await label(page, "Ur of the Chaldees").scrollIntoViewIfNeeded();
  const mapAt = (await map(page).boundingBox())!.y;
  await label(page, "Ur of the Chaldees").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
  await expect(panel(page).getByRole("list", { name: "Facts" })).toContainText("Coordinates");
  expect((await map(page).boundingBox())!.y).toBe(mapAt);
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

  // A selection made elsewhere within the double click time drops a click waiting on a dot.
  await label(page, "Ur of the Chaldees").click();
  await panel(page).getByRole("list", { name: /^Location/ }).getByRole("button", { name: /^Canaan/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Canaan");
  await page.waitForTimeout(500);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Canaan");
});

test("the open map is a block of its own below the Selected Node's details, and the lists below keep their place whatever it shows", async ({ page }) => {
  await thirdParty(page);
  // Fixture: Haran has a point; Terah is a Person; Canaan is a Place with none.
  await page.goto("/?focus=place:haran_527");
  await focusIs(page, "place:haran_527");
  await openMap(page);
  await expect(label(page, "Haran")).toBeVisible();
  const facts = (await panel(page).getByRole("list", { name: "Facts" }).boundingBox())!;
  const m = (await map(page).boundingBox())!;
  expect(m.y).toBeGreaterThanOrEqual(facts.y + facts.height);
  expect(m.height).toBeGreaterThanOrEqual(280);

  // A click in a list changes what the block shows (a Person: no switch and the Focus's
  // Neighbours; then a Place with no point), and what lies above it; the lists stay where they were
  // on screen, so the second click of a double click lands where the first did.
  const people = panel(page).getByRole("list", { name: /^Person/ });
  const places = panel(page).getByRole("list", { name: /^Location/ });
  const at = async () => [(await people.boundingBox())!.y, (await places.boundingBox())!.y];
  for (const [item, shows] of [
    [people.getByRole("button", { name: /^Terah/ }), panel(page).getByText("The Focus, Haran, and its Neighbours.")],
    [places.getByRole("button", { name: /^Canaan/ }), panel(page).getByText(/^No point for this Location\./)],
  ]) {
    await item.scrollIntoViewIfNeeded();
    const before = await at();
    await item.click();
    await expect(shows).toBeVisible();
    expect(await at()).toEqual(before);
  }
});

test("Tab reaches the view switch, every dot, and Recentre map; Enter on a dot selects at once; a text list names the Places shown; reduced motion re-frames in one step", async ({ page }) => {
  await thirdParty(page);
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
  expect(reached).toEqual(expect.arrayContaining(["Recentre map", "Location", "Neighbours", "Haran", "Ur of the Chaldees"]));

  // Enter selects, and the keyboard stays on the dot. Its lack of the pointer's wait for a second click
  // is not timed: a runner under software WebGL takes longer than that wait to show anything.
  const ur = map(page).getByRole("button", { name: "Ur of the Chaldees" });
  await ur.focus();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
  await expect(ur).toBeFocused();

  // With reduced motion, Recentre map puts the map back at once, with no glide.
  await map(page).scrollIntoViewIfNeeded();
  const framed = await selectedDot(map(page));
  await pan(page, map(page));
  await panel(page).getByRole("button", { name: "Recentre map" }).focus();
  await page.keyboard.press("Enter");
  expect(Math.abs((await selectedDot(map(page))).x - framed.x)).toBeLessThan(2);
});

test("two Places at one point both show and each can be selected; after a pan, Recentre map and a new selection frame the map again", async ({ page }) => {
  await thirdParty(page);
  // Fixture: Bethlehem's Ring 1 Places, Judea and Jerusalem, share one point.
  await page.goto("/?focus=place:bethlehem_218");
  await focusIs(page, "place:bethlehem_218");
  await openMap(page);
  await view(page, "Neighbours").click();
  await expect(label(page, "Judea")).toBeVisible();
  await expect(label(page, "Jerusalem")).toBeVisible();

  await map(page).scrollIntoViewIfNeeded();
  const framed = await selectedDot(map(page));
  await pan(page, map(page));
  await panel(page).getByRole("button", { name: "Recentre map" }).click();
  await expect.poll(async () => Math.abs((await selectedDot(map(page))).x - framed.x)).toBeLessThan(2);

  // The second name at the shared point selects; Jerusalem's Neighbours are Judea, at its own point,
  // and Bethlehem. Selecting Bethlehem again frames the map as before the pan.
  await pan(page, map(page));
  await label(page, "Jerusalem").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Jerusalem");
  await label(page, "Bethlehem").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Bethlehem");
  await expect.poll(async () => Math.abs((await selectedDot(map(page))).x - framed.x)).toBeLessThan(2);
  // The first name at the shared point selects too.
  await label(page, "Judea").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Judea");
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("after a glide and a framing that does not move, a pan by the reader holds when the model changes", async ({ page }) => {
    await thirdParty(page);
    await page.goto("/?focus=place:haran_527");
    await focusIs(page, "place:haran_527");
    await openMap(page);
    await expect(label(page, "Haran")).toBeVisible();
    await map(page).scrollIntoViewIfNeeded();
    // A change to the model draws the dots again, and frames the map while it follows.
    const redrawn = async (button: string) => {
      await map(page).locator(".map-place.selected").evaluate((e) => e.setAttribute("data-drawn", ""));
      await panel(page).getByRole("button", { name: button, exact: true }).click();
      await expect(map(page).locator(".map-place.selected:not([data-drawn])")).toHaveCount(1);
    };

    // Where the Selected Place's dot comes to rest after a glide or a drag's drift: still for 300 ms.
    const rest = async () => {
      let last = await selectedDot(map(page));
      await expect
        .poll(async () => {
          await page.waitForTimeout(300);
          const [was, now] = [last, (last = await selectedDot(map(page)))];
          return Math.abs(now.x - was.x) + Math.abs(now.y - was.y);
        })
        .toBe(0);
      return last;
    };

    // Neighbours frames Haran and Ur with a glide.
    await view(page, "Neighbours").click();
    await expect(label(page, "Ur of the Chaldees")).toBeVisible();
    await rest();
    // Pinned: framed again where it already is, which ends at once. Then the reader pans.
    await redrawn("Pin");
    await pan(page, map(page));
    const panned = await rest();

    // Unpinned: the dots are drawn again, and the map stays where the reader put it.
    await redrawn("Unpin");
    await page.waitForTimeout(500);
    expect(await selectedDot(map(page))).toEqual(panned);
  });
});
