import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "../scene";
import { doubleTap, drag } from "../touch";
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

// Whether a finger at this point would touch this element or something inside it.
const hits = (on: Locator, x: number, y: number) => on.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x, y });
const middle = async (on: Locator) => {
  const b = (await on.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const selectedDot = async (page: Page) => (await page.locator(".map-place.selected .dot").boundingBox())!;

// The owner's phone upright, with the sheet dragged up to full, and on its side (#87).
for (const [size, full] of [
  [{ width: 325, height: 600 }, true],
  [{ width: 760, height: 330 }, false],
] as const) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test("the open map fits under the held actions and covers none of them, a drag in it moves the map alone, and its dots and names are 44 px to tap", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
      await page.route(
        (url) => url.hostname !== "localhost",
        (route) => route.abort(),
      );
      await page.goto("/?focus=place:haran_527");
      await focusIs(page, "place:haran_527");
      const sheet = page.getByRole("region", { name: "Sheet" });
      const details = sheet.getByRole("tabpanel", { name: "Details" });
      const panel = details.getByRole("complementary", { name: "Selected Node" });
      if (full) {
        await sheet.getByRole("button", { name: "Close the sheet" }).focus();
        await page.keyboard.press("ArrowUp");
      }
      await details.getByRole("button", { name: "Show map" }).tap();
      await details.getByRole("button", { name: "Continue" }).tap();
      const map = details.getByRole("region", { name: "Map" });
      const name = map.getByText("Haran", { exact: true });
      await expect(name).toBeVisible();

      // The block scrolled up to the actions, held at the top of the panel: the whole map shows below
      // them, the Selected Place's name on its dot.
      const actions = ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"].map((name) => panel.getByRole("button", { name, exact: true }));
      const scrollBy = (dy: number) => panel.evaluate((e, d) => e.scrollBy(0, d), dy);
      const held = (await panel.boundingBox())!.y + (await actions[0].boundingBox())!.height;
      await scrollBy((await details.getByRole("button", { name: "Hide map" }).boundingBox())!.y - held - 8);
      await expect(map).toBeInViewport({ ratio: 1 });
      await expect(name).toBeInViewport({ ratio: 1 });

      // A dot and a name are each at least 44 px to tap: a finger 21 px off their middle still lands on them.
      for (const target of [map.locator(".dot"), name]) {
        const m = await middle(target);
        const place = target.locator("xpath=ancestor::*[contains(@class, 'map-place')]");
        for (const [dx, dy] of [
          [-21, 0],
          [21, 0],
          [0, -21],
          [0, 21],
        ])
          expect(await hits(place, m.x + dx, m.y + dy), `${dx}, ${dy}`).toBe(true);
      }

      // A finger drag in the map pans the map; the sheet and the panel stay where they were.
      const [s, top, dot] = [await sheet.boundingBox(), await panel.evaluate((e) => e.scrollTop), await selectedDot(page)];
      const m = (await map.boundingBox())!;
      const from = { x: m.x + m.width * 0.3, y: m.y + m.height * 0.7 };
      await drag(page, from, { x: from.x + 40, y: from.y - 30 });
      await expect.poll(async () => (await selectedDot(page)).x - dot.x).toBeGreaterThan(20);
      expect(await sheet.boundingBox()).toEqual(s);
      expect(await panel.evaluate((e) => e.scrollTop)).toBe(top);

      // Scrolled on, the map passes under the held actions, which stay on top of it.
      await scrollBy(40);
      for (const a of actions) {
        const c = await middle(a);
        expect(await hits(a, c.x, c.y)).toBe(true);
      }
    });
  });
}
