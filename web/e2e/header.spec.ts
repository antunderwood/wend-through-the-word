import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "./scene";

// The Selected Node's header on a desktop window: the name, the type line, the Relationship line only
// when there is one, and the six buttons stay at the top of the panel, and everything else scrolls
// behind it as one column (decision 200).
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const BUTTONS = ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"];
const button = (page: Page, name: string) => panel(page).getByRole("button", { name, exact: true });
const relationship = (page: Page) => panel(page).getByRole("paragraph").filter({ hasText: /^Relationship:/ });
const people = (page: Page) => panel(page).getByRole("list", { name: "Person (24)" });
const box = async (l: Locator) => (await l.boundingBox())!;

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

for (const size of [
  { width: 800, height: 600 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test.beforeEach(async ({ page }) => {
      await openOnAbraham(page);
      await focusIs(page, "person:abraham_58");
    });

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
      const headerBottom = () => panel(page).getByRole("heading", { level: 2 }).evaluate((h) => h.parentElement!.getBoundingClientRect().bottom);
      const focusedTop = () => page.evaluate(() => document.activeElement!.getBoundingClientRect().top);
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
      expect(await focusedTop()).toBeGreaterThanOrEqual(await headerBottom());

      // Isaac's row lies behind the header; Shift+Tab from its correction flag focuses its name,
      // which is scrolled clear of the header.
      const isaac = people(page).getByRole("listitem").filter({ hasText: /^Isaac/ });
      const behind = await headerBottom();
      await isaac.evaluate((row, at) => {
        const p = document.getElementById("panel")!;
        p.scrollTop += row.getBoundingClientRect().top - at + 10;
      }, behind);
      expect((await box(isaac)).y).toBeLessThan(behind);
      await isaac.getByRole("button", { name: "Suggest a correction to the link to Isaac" }).evaluate((b: HTMLElement) => b.focus({ preventScroll: true }));
      await page.keyboard.press("Shift+Tab");
      await expect(isaac.getByRole("button", { name: /^Isaac/ })).toBeFocused();
      expect(await focusedTop()).toBeGreaterThanOrEqual(await headerBottom());
    });

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
  });
}
