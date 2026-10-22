import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "../scene";
import { drag } from "../touch";
import { STEPS } from "../../src/tour";

// The tour on a phone (docs/specs/mobile.md): the same steps as on a desktop (e2e/tour.spec.ts),
// with its box clear of the step's target and of the open bottom sheet.
const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348",
  NAHOR = "person:nahor_2143",
  JESUS = "person:jesus_905",
  GOD = "person:god_1324",
  PETER = "person:peter_2745";
const tour = (page: Page) => page.getByRole("dialog", { name: "Tour" });
const ring = (page: Page) => page.locator(".tour-target");
const scene = (page: Page) => page.locator('[data-tour="scene"]');
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
// On a phone the help link ends the Details tab.
const help = (page: Page) => details(page).getByRole("button", { name: "Help: take the tour" });

test.use({ reducedMotion: "reduce" });
// Each test walks up to every step, each a tap or two that waits for the scene or the sheet: on
// software WebGL that is close to the default 30 s, so the whole file has three times as long.
test.slow();

// A reader with a Your Path, a pin, a note, a hidden type, and a selection, in a view.
async function reader(page: Page, view: string) {
  await page.addInitScript(
    ([view, journey, notes]) => {
      if (localStorage.getItem("wend.notes")) return; // only the first load
      localStorage.setItem("wend.view", view);
      localStorage.setItem("wend.journey", journey);
      localStorage.setItem("wend.notes", notes);
    },
    [view, JSON.stringify({ focus: SARAH, path: [ABRAHAM] }), JSON.stringify({ [ABRAHAM]: "My own note." })],
  );
  await page.goto(`/?sel=${HAGAR}&pins=${NAHOR}&hide=place`);
  await focusIs(page, SARAH);
}
// What the tour must leave as it was: the address, Your Path, the Selected Node, the sheet's tab,
// and everything kept in this browser.
const state = async (page: Page) => ({
  address: new URL(page.url()).search,
  path: await bar(page).getByRole("listitem").allTextContents(),
  selected: await page.getByRole("complementary", { name: "Selected Node", includeHidden: true }).getByRole("heading", { level: 2, includeHidden: true }).textContent(),
  tab: await sheet(page).getByRole("tab", { selected: true }).textContent(),
  kept: await page.evaluate(() => ({ ...localStorage })),
  history: await page.evaluate(() => history.length),
});
// The tour box overlaps neither the ring around the step's target nor the open sheet, and it is on
// screen; so is the ring.
async function uncovered(page: Page) {
  await expect(ring(page)).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Close the sheet" })).toBeVisible();
  const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
  await expect
    .poll(async () => {
      const [box, target, under] = [(await tour(page).boundingBox())!, (await ring(page).boundingBox())!, (await sheet(page).boundingBox())!];
      return apart(box, target) && apart(box, under) && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390;
    })
    .toBe(true);
}

for (const view of ["A", "C"] as const) {
  test(`Do it for me passes every step and the reader's state comes back, in view ${view}`, async ({ page }) => {
    await reader(page, view);
    const sent: string[] = [];
    page.on("request", (r) => (r.method() !== "GET" || !new URL(r.url()).pathname.startsWith("/data/")) && sent.push(`${r.method()} ${r.url()}`));

    const before = await state(page);
    await help(page).tap();
    for (let n = 1; n <= STEPS.length; n++) {
      await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
      await uncovered(page);
      await tour(page).getByRole("button", { name: "Do it for me" }).tap();
    }
    await expect(tour(page)).toContainText("Done");
    // Nothing kept in this browser while it ran: the sheet's tab and the note included.
    expect((await state(page)).kept).toEqual(before.kept);
    await tour(page).getByRole("button", { name: "Finish", exact: true }).tap();
    await expect(tour(page)).toBeHidden();
    await focusIs(page, SARAH);
    // Read opened the Reader tab in the tour; the Details tab comes back.
    expect(await state(page)).toEqual(before);
    expect(sent).toEqual([]);
  });
}

// A point on the scene that nothing lies over: the tour box and the controls float above it.
async function bare(page: Page) {
  const s = (await scene(page).boundingBox())!,
    top = (await sheet(page).boundingBox())!.y;
  const point = await page.evaluate(
    ([x0, y0, x1, y1]) => {
      for (let y = y0 + 20; y < y1 - 20; y += 20)
        for (let x = x0 + 20; x < x1 - 20; x += 20) if (document.elementFromPoint(x, y)?.closest('[data-tour="scene"]')) return { x, y };
    },
    [s.x, s.y, s.x + s.width, top],
  );
  expect(point).toBeDefined();
  return point!;
}
const search = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Search", exact: true }).tap();
  await page.getByRole("searchbox", { name: "Search" }).fill(name);
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
};
// The reader's own action for each step, by touch.
const BY_TOUCH: ((page: Page) => Promise<unknown>)[] = [
  async (page) => {
    const from = await bare(page);
    await drag(page, from, { x: from.x + 60, y: from.y });
  },
  (page) => search(page, "Jesus Christ"),
  // After a drag the camera glides to a stop over seconds, so a name is tapped where it is, still or not.
  (page) => scene(page).locator(`[data-node="${GOD}"]`).tap({ force: true }),
  (page) => scene(page).locator(`[data-node="${JESUS}"]`).tap({ force: true }),
  (page) => details(page).getByRole("button", { name: "27 more" }).tap(),
  (page) => details(page).getByRole("list", { name: /^Theme/ }).getByRole("button", { name: /^Miracles/ }).tap(),
  (page) => search(page, "Simon Peter"),
  async (page) => {
    await bar(page).getByRole("button", { name: "Jesus Christ" }).tap();
    await details(page).getByRole("button", { name: "Pin", exact: true }).tap();
  },
  (page) => details(page).getByRole("button", { name: "Next", exact: true }).tap(),
  (page) => bar(page).getByRole("button", { name: "Clear", exact: true }).tap(),
  (page) => bar(page).getByRole("button", { name: "Undo clear" }).tap(),
  // Read opens the Reader tab; the next step's note box is in the Details tab, which the tour opens.
  (page) => details(page).getByRole("button", { name: "Read", exact: true }).tap(),
  async (page) => {
    const box = details(page).getByRole("textbox", { name: /^Note on Simon Peter/ });
    await box.tap();
    await box.fill("Peter, the rock.");
  },
];

for (const view of ["A", "C"] as const) {
  test(`the reader's own touch actions pass every step and a kept note stays, in view ${view}`, async ({ page }) => {
    await reader(page, view);
    const before = await state(page);
    await help(page).tap();
    for (const [i, act] of BY_TOUCH.entries()) {
      await expect(tour(page)).toContainText(`Step ${i + 1} of ${STEPS.length}`);
      await uncovered(page);
      await act(page);
    }
    await expect(tour(page)).toContainText("Done");
    await tour(page).getByRole("button", { name: "Finish and keep my note" }).tap();
    await focusIs(page, SARAH);
    const notes = JSON.stringify({ [ABRAHAM]: "My own note.", [PETER]: "Peter, the rock." });
    expect(await state(page)).toEqual({ ...before, kept: { ...before.kept, "wend.notes": notes } });
  });
}

test("the camera step names drag and pinch, the search step points at the search button, a step says tap, and a step in the sheet opens its tab", async ({ page }) => {
  await reader(page, "A");
  await help(page).tap();
  await expect(tour(page)).toContainText("In the tilted plane, drag to pan and pinch to zoom.");
  await tour(page).getByRole("button", { name: "Do it for me" }).tap();

  await expect(tour(page)).toContainText(`Step 2 of ${STEPS.length}`);
  const button = (await page.getByRole("button", { name: "Search", exact: true }).boundingBox())!;
  await expect.poll(async () => (await ring(page).boundingBox())!.x).toBeCloseTo(button.x - 5, 0);
  expect((await ring(page).boundingBox())!.y).toBeCloseTo(button.y - 5, 0);

  // The reader moves to the Reader tab; the step whose target is in Details opens it again.
  for (let n = 2; n <= 4; n++) {
    // A touch screen taps where a mouse clicks (decision 182).
    if (n === 3) await expect(tour(page)).toContainText("Tap God to select him");
    await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  }
  await expect(tour(page)).toContainText(`Step 5 of ${STEPS.length}`);
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  await expect(tour(page)).toContainText(`Step 6 of ${STEPS.length}`);
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await uncovered(page);
});

test("a tour taken from the offer on the Reader tab gives the Reader tab back when it ends", async ({ page }) => {
  // A browser not yet offered the tour, whose sheet was left on its Reader tab.
  await page.addInitScript(() => {
    localStorage.removeItem("wend.tourOffered");
    localStorage.setItem("wend.sheetTab", "reader");
  });
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  await expect(tour(page)).toContainText("studying Jesus Christ");
  await tour(page).getByRole("button", { name: "Take the tour" }).tap();
  for (let n = 1; n <= 4; n++) {
    await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
    await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  }
  // Jesus Christ's Themes are in the Details tab, which the tour opens.
  await expect(tour(page)).toContainText(`Step 5 of ${STEPS.length}`);
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await uncovered(page);
  await tour(page).getByRole("button", { name: "End tour" }).tap();
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => localStorage.getItem("wend.sheetTab"))).toBe("reader");
});
