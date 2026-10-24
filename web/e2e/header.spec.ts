import { expect, test, type Locator, type Page } from "@playwright/test";
import { movedSincePress, openMap, pan, thirdParty } from "./map";
import { focusIs, openOnAbraham } from "./scene";

// The Selected Node's header on a desktop window: the name, the type line, the Relationship line only
// when there is one, and the six buttons stay at the top of the panel, and everything else scrolls
// behind it as one column (decision 201).
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const BUTTONS = ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"];
const button = (page: Page, name: string) => panel(page).getByRole("button", { name, exact: true });
const relationship = (page: Page) => panel(page).getByRole("paragraph").filter({ hasText: /^Relationship:/ });
const people = (page: Page) => panel(page).getByRole("list", { name: "Person (24)" });
const box = async (l: Locator) => (await l.boundingBox())!;
const headerBottom = (page: Page) => panel(page).getByRole("heading", { level: 2 }).evaluate((h) => h.parentElement!.getBoundingClientRect().bottom);

// A click at a point on the item, then the item's largest move on screen, in any frame drawn from the
// click until the second click of a double click could come (and the loads it started have ended).
type Watched = Window & { moved?: Promise<number> };
async function clickHeld(page: Page, item: Locator, at: { x: number; y: number }) {
  // Watching starts before the click is sent.
  await item.evaluate((e) => {
    const y = e.getBoundingClientRect().top;
    (window as Watched).moved = new Promise<number>((done) => {
      let most = 0,
        end = 0;
      requestAnimationFrame(function frame(now) {
        end ||= now + 800;
        most = Math.max(most, Math.abs(e.getBoundingClientRect().top - y));
        if (now < end) requestAnimationFrame(frame);
        else done(most);
      });
    });
  });
  await page.mouse.click(at.x, at.y);
  return page.evaluate(() => (window as Watched).moved!);
}
// The first click of a double click on a list item in view: the item never moves until the second
// could come, and is still what lies at the point clicked. Returns the point, for the second click.
async function firstClickHolds(page: Page, item: Locator) {
  await item.scrollIntoViewIfNeeded();
  const r = await box(item);
  const at = { x: r.x + 12, y: r.y + r.height / 2 };
  expect(await clickHeld(page, item, at)).toBe(0);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 80), [at.x, at.y]);
  expect(await item.evaluate((e, [x, y]) => e.contains(document.elementFromPoint(x, y)), [at.x, at.y]), hit).toBe(true);
  return at;
}

test.use({ reducedMotion: "reduce" });

const onAbraham = async ({ page }: { page: Page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
};

// The proof of the hold at a small and a large desktop window; the rest at 1440 x 900 only.
for (const size of [
  { width: 800, height: 600 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });
    test.beforeEach(onAbraham);

    // The risk of a header whose height follows the selection: the first click of a double click
    // changes the header and everything above the lists, and the second must land on the same item.
    test("a double click on a Neighbour list item makes it the Focus, and the list never moves between its two clicks", async ({ page }) => {
      // Fixture: Jacob has less above the list than Abraham (whose Dictionary Entry and note box go);
      // Sarah far more (a Relationship line, shared Verses, a curated note, a Dictionary Entry).
      const sarah = people(page).getByRole("button", { name: /^Sarah/ });
      await firstClickHolds(page, people(page).getByRole("button", { name: /^Jacob/ }));
      await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Jacob (Israel)");
      const at = await firstClickHolds(page, sarah);
      await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Sarah");
      await page.mouse.dblclick(at.x, at.y);
      await focusIs(page, "person:sarah_2473");
    });
  });
}

test.describe("at 1440 x 900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(onAbraham);

  test("the header has no gap without a Relationship and shows the line when there is one", async ({ page }) => {
    // The Focus itself: the buttons follow the type line at the normal spacing.
    const type = panel(page).getByText("Person", { exact: true });
    const gap = async () => (await box(button(page, "Make Focus"))).y - ((await box(type)).y + (await box(type)).height);
    await expect(relationship(page)).toHaveCount(0);
    expect(await gap()).toBeLessThan(12);
    // Isaac: the Relationship line sits between the type line and the buttons.
    await people(page).getByRole("button", { name: /^Isaac/ }).click();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
    await expect(relationship(page)).toBeVisible();
    const line = await box(relationship(page));
    expect(line.y).toBeGreaterThan((await box(type)).y);
    expect(line.y + line.height).toBeLessThanOrEqual((await box(button(page, "Make Focus"))).y);
  });

  test("scrolled to the end, the name and all six buttons stay at the top, and the column scrolls behind the header", async ({ page }) => {
    const name = panel(page).getByRole("heading", { level: 2 });
    const top = (await box(name)).y;
    // A long column: the whole Dictionary Entry and every Theme.
    await panel(page).getByRole("button", { name: "Read more" }).click();
    await panel(page).getByRole("button", { name: "31 more" }).click();
    await panel(page).evaluate((p) => p.scrollTo(0, p.scrollHeight));
    await expect(panel(page).getByRole("list", { name: "Theme (37)" }).getByRole("listitem").last()).toBeInViewport();
    expect((await box(name)).y).toBe(top);
    // Each button whole on screen and nothing over its middle; the header is opaque and starts at the
    // panel's top edge, so points just above the name and just below the buttons are the header's
    // own, not the column scrolled behind it.
    for (const b of [...BUTTONS.map((n) => button(page, n)), name]) {
      await expect(b).toBeInViewport({ ratio: 1 });
      const r = await box(b);
      expect(await b.evaluate((e, [x, y]) => e.contains(document.elementFromPoint(x, y)), [r.x + r.width / 2, r.y + r.height / 2])).toBe(true);
    }
    const below = await box(button(page, "Suggest a correction"));
    const p = await box(panel(page));
    for (const [x, y] of [
      [below.x + below.width / 2, below.y + below.height + 3],
      [p.x + p.width / 2, p.y + 2],
    ])
      expect(await name.evaluate((h, [x, y]) => h.parentElement!.contains(document.elementFromPoint(x, y)), [x, y])).toBe(true);
    // One column: nothing in the panel scrolls on its own.
    const inner = await panel(page).evaluate((p) => [...p.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY === "auto").length);
    expect(inner).toBe(0);
  });

  test("Tab reaches the header's buttons first, then the column, and a focused list item is scrolled clear of the header", async ({ page }) => {
    // The focus ring is drawn outside the control (focus.css): its top edge, not the control's, must
    // be clear of the header.
    const ringTop = () =>
      page.evaluate(() => {
        const e = document.activeElement!,
          ring = getComputedStyle(e);
        return e.getBoundingClientRect().top - parseFloat(ring.outlineWidth) - parseFloat(ring.outlineOffset);
      });
    // From the chevron, just before the panel: Make Focus is disabled for the Focus itself. The
    // header's buttons are always in view, so focusing them never scrolls the column.
    const scrolled = () => panel(page).evaluate((p) => p.scrollTop);
    await panel(page).evaluate((p) => p.scrollTo(0, 200));
    await page.getByRole("button", { name: "Hide panel" }).focus();
    for (const name of BUTTONS.slice(1)) {
      await page.keyboard.press("Tab");
      await expect(button(page, name)).toBeFocused();
      expect(await scrolled()).toBe(200);
    }
    await page.keyboard.press("Tab");
    expect(await panel(page).evaluate((p) => p.contains(document.activeElement))).toBe(true);
    expect(await ringTop()).toBeGreaterThanOrEqual(await headerBottom(page));

    // Isaac's row lies behind the header; Shift+Tab from its correction flag focuses its name,
    // which is scrolled clear of the header.
    const isaac = people(page).getByRole("listitem").filter({ hasText: /^Isaac/ });
    const behind = await headerBottom(page);
    await isaac.evaluate((row, at) => {
      const p = document.getElementById("panel")!;
      p.scrollTop += row.getBoundingClientRect().top - at + 10;
    }, behind);
    expect((await box(isaac)).y).toBeLessThan(behind);
    await isaac.getByRole("button", { name: "Suggest a correction to the link to Isaac" }).evaluate((b: HTMLElement) => b.focus({ preventScroll: true }));
    await page.keyboard.press("Shift+Tab");
    await expect(isaac.getByRole("button", { name: /^Isaac/ })).toBeFocused();
    expect(await ringTop()).toBeGreaterThanOrEqual(await headerBottom(page));
  });

  test("a double click on a shared Verse at the top of the panel makes it the Focus though the header grows shorter", async ({ page }) => {
    // Fixture: Hagar's Relationship line takes a line more than the Verse's. The panel is at its
    // top, so it cannot scroll back for the line the header loses.
    await people(page).getByRole("button", { name: /^Hagar/ }).click();
    await expect(relationship(page)).toBeVisible();
    await panel(page).evaluate((p) => p.scrollTo(0, 0));
    const verse = panel(page).getByRole("list", { name: /^Together in/ }).getByRole("button").first();
    const ref = (await verse.textContent())!.trim();
    const at = await firstClickHolds(page, verse);
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(ref);
    await page.mouse.dblclick(at.x, at.y);
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(ref);
    await expect(button(page, "Make Focus")).toBeDisabled();
  });

  test("after a click in a list, a press elsewhere in the panel is not held: Show map opens below its button", async ({ page }) => {
    await firstClickHolds(page, people(page).getByRole("button", { name: /^Jacob/ }));
    const toggle = panel(page).getByRole("button", { name: /^(Show|Hide) map$/ });
    await expect(toggle).toBeInViewport({ ratio: 1 });
    const y = (await box(toggle)).y;
    await toggle.click();
    await expect(panel(page).getByRole("button", { name: "Continue" })).toBeVisible();
    expect((await box(toggle)).y).toBe(y);
  });

  test("the space a hold leaves under the header goes when the hold ends, here with a press on Pin", async ({ page }) => {
    // As above: Hagar's first shared Verse at the panel's top, where the header grows shorter.
    await people(page).getByRole("button", { name: /^Hagar/ }).click();
    await expect(relationship(page)).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: /Dictionary/ })).toBeVisible(); // her details loaded
    await panel(page).evaluate((p) => p.scrollTo(0, 0));
    const shared = panel(page).getByRole("heading", { name: /^Together in/ });
    const below = async () => (await box(shared)).y - (await headerBottom(page));
    const usual = await below();
    await firstClickHolds(page, panel(page).getByRole("list", { name: /^Together in/ }).getByRole("button").first());
    expect(await below()).toBeGreaterThan(usual + 10);
    await button(page, "Pin").click();
    await expect(button(page, "Unpin")).toBeVisible();
    // Once the click is over: the panel is at its top, so the column closes up.
    await expect.poll(async () => Math.abs((await below()) - usual)).toBeLessThan(1);
  });
});

test.describe("at 1440 x 900, on the map", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a selection made on the map holds the map until the reader's next press in it", async ({ page }) => {
    // Fixture: Haran's Neighbours on the map include Ur of the Chaldees; Abraham, pinned, shares
    // Verses with Ur.
    await thirdParty(page, "tile");
    await page.goto("/?focus=place:haran_527&pins=person:abraham_58");
    await focusIs(page, "place:haran_527");
    await openMap(panel(page));
    await panel(page).getByRole("group", { name: "Map view" }).getByRole("button", { name: "Neighbours" }).click();
    const map = panel(page).getByRole("region", { name: "Map" });
    const ur = map.getByText("Ur of the Chaldees", { exact: true });
    await ur.scrollIntoViewIfNeeded();
    const moved = await movedSincePress(map);
    await ur.click();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Ur of the Chaldees");
    const together = panel(page).getByRole("heading", { name: /^Together with Abraham/ });
    await expect(together).toBeVisible();
    expect(await moved()).toBe(0);
    // A pan ends the hold: a list gone from above the map (an unpin, from outside the panel) then
    // moves the map up, as without a hold, and the panel does not scroll.
    await pan(page, map);
    const scrolled = await panel(page).evaluate((p) => p.scrollTop);
    await page.evaluate(() => window.wendApply!({ type: "unpin", id: "person:abraham_58" }));
    await expect(together).toHaveCount(0);
    expect(await panel(page).evaluate((p) => p.scrollTop)).toBe(scrolled);
  });
});
