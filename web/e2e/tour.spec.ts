import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "./scene";
import { STEPS } from "../src/tour";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348",
  NAHOR = "person:nahor_2143",
  JESUS = "person:jesus_905",
  GOD = "person:god_1324",
  PETER = "person:peter_2745";
const tour = (page: Page) => page.getByRole("dialog", { name: "Tour" });
// The tour's targets carry data-tour; names in the scene carry their node ID.
const scene = (page: Page) => page.locator('[data-tour="scene"]');
const help = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: "Help: take the tour" });

test.use({ reducedMotion: "reduce" });

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
// What the tour must leave as it was: the address (Focus, selection, pins, filters, view), Your Path,
// the Selected Node, and everything kept in this browser.
const state = async (page: Page) => ({
  address: new URL(page.url()).search,
  path: await page.getByRole("navigation", { name: "Your Path" }).getByRole("listitem").allTextContents(),
  selected: await page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 }).textContent(),
  kept: await page.evaluate(() => ({ ...localStorage })),
  history: await page.evaluate(() => history.length),
});
// The tour box and the ring around the step's target never overlap; the ring is always on screen.
async function uncovered(page: Page) {
  const target = page.locator(".tour-target");
  await expect(target).toBeVisible();
  await expect
    .poll(async () => {
      const [a, b] = [(await tour(page).boundingBox())!, (await target.boundingBox())!];
      return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    })
    .toBe(true);
}

for (const view of ["A", "B", "C"] as const) {
  test(`Do it for me passes every step and the reader's state comes back, in view ${view}`, async ({ page }) => {
    await reader(page, view);
    const before = await state(page);
    // Only data files are fetched during the tour.
    const sent: string[] = [];
    page.on("request", (r) => (r.method() !== "GET" || !new URL(r.url()).pathname.startsWith("/data/")) && sent.push(`${r.method()} ${r.url()}`));

    await help(page).click();
    for (let n = 1; n <= STEPS.length; n++) {
      await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
      await uncovered(page);
      await tour(page).getByRole("button", { name: "Do it for me" }).click();
    }
    await expect(tour(page)).toContainText("Done");
    // Nothing kept in this browser while it ran, the note included.
    expect((await state(page)).kept).toEqual(before.kept);
    await tour(page).getByRole("button", { name: "Finish", exact: true }).click();
    await expect(tour(page)).toBeHidden();
    await focusIs(page, SARAH);
    expect(await state(page)).toEqual(before);
    expect(sent).toEqual([]);
    // The tour's note is gone: the reader's next note keeps only the reader's notes.
    await page.getByRole("navigation", { name: "Your Path" }).getByRole("button", { name: "Abraham" }).click();
    await page.getByRole("textbox", { name: /^Note on Abraham/ }).fill("My own note, edited.");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wend.notes")!))).toEqual({ [ABRAHAM]: "My own note, edited." });
  });
}

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
// The reader's own action for each step, by mouse.
const BY_MOUSE: ((page: Page) => Promise<unknown>)[] = [
  async (page) => {
    const s = (await scene(page).boundingBox())!;
    await page.mouse.move(s.x + s.width - 40, s.y + s.height / 2);
    await page.mouse.wheel(0, -200);
  },
  async (page) => {
    await page.getByRole("searchbox", { name: "Search" }).fill("Jesus Christ");
    await page.getByRole("list", { name: "Search results" }).getByRole("button").first().click();
  },
  (page) => scene(page).locator(`[data-node="${GOD}"]`).click(),
  (page) => scene(page).locator(`[data-node="${JESUS}"]`).click(),
  (page) => panel(page).getByRole("button", { name: "27 more" }).click(),
  (page) => panel(page).getByRole("list", { name: /^Theme/ }).getByRole("button", { name: /^Miracles/ }).click(),
  // Simon Peter's scene label can be crowded out (decision 124), so by search.
  async (page) => {
    await page.getByRole("searchbox", { name: "Search" }).fill("Simon Peter");
    await page.getByRole("list", { name: "Search results" }).getByRole("button").first().click();
  },
  async (page) => {
    await bar(page).getByRole("button", { name: "Jesus Christ" }).click();
    await panel(page).getByRole("button", { name: "Pin", exact: true }).click();
  },
  (page) => panel(page).getByRole("button", { name: "Next", exact: true }).click(),
  (page) => bar(page).getByRole("button", { name: "Clear", exact: true }).click(),
  (page) => bar(page).getByRole("button", { name: "Undo clear" }).click(),
  (page) => panel(page).getByRole("button", { name: "Read", exact: true }).click(),
  (page) => panel(page).getByRole("textbox", { name: /^Note on Simon Peter/ }).fill("Peter, the rock."),
];

for (const view of ["A", "B", "C"] as const) {
  test(`the reader's own actions pass every step and a kept note stays, in view ${view}`, async ({ page }) => {
    await reader(page, view);
    const before = await state(page);
    await help(page).click();
    for (const [i, act] of BY_MOUSE.entries()) {
      await expect(tour(page)).toContainText(`Step ${i + 1} of ${STEPS.length}`);
      await uncovered(page);
      await act(page);
    }
    await expect(tour(page)).toContainText("Done");
    await tour(page).getByRole("button", { name: "Finish and keep my note" }).click();
    await focusIs(page, SARAH);
    const notes = JSON.stringify({ [ABRAHAM]: "My own note.", [PETER]: "Peter, the rock." });
    expect(await state(page)).toEqual({ ...before, kept: { ...before.kept, "wend.notes": notes } });
  });
}

test("the whole tour with the keyboard only", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  const enter = (l: ReturnType<Page["locator"]>) => l.press("Enter");
  const search = async (name: string) => {
    await page.getByRole("searchbox", { name: "Search" }).focus();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
  };
  // Fixture: Jesus Christ's Ring 1 starts with his People by weight, God first.
  const BY_KEYBOARD: (() => Promise<unknown>)[] = [
    () => enter(tour(page).getByRole("button", { name: "Do it for me" })), // the camera has no keys
    () => search("Jesus Christ"),
    async () => {
      await scene(page).focus();
      await page.keyboard.press("ArrowRight");
    },
    () => enter(bar(page).getByRole("button", { name: "Jesus Christ" })),
    () => enter(panel(page).getByRole("button", { name: "27 more" })),
    () => enter(panel(page).getByRole("list", { name: /^Theme/ }).getByRole("button", { name: /^Miracles/ })),
    () => search("Simon Peter"),
    async () => {
      await enter(bar(page).getByRole("button", { name: "Jesus Christ" }));
      await enter(panel(page).getByRole("button", { name: "Pin", exact: true }));
    },
    () => enter(panel(page).getByRole("button", { name: "Next", exact: true })),
    () => enter(bar(page).getByRole("button", { name: "Clear", exact: true })),
    () => enter(bar(page).getByRole("button", { name: "Undo clear" })),
    () => enter(panel(page).getByRole("button", { name: "Read", exact: true })),
    async () => {
      await panel(page).getByRole("textbox", { name: /^Note on/ }).focus();
      await page.keyboard.type("Typed.");
    },
  ];
  await enter(help(page));
  for (const [i, act] of BY_KEYBOARD.entries()) {
    await expect(tour(page)).toContainText(`Step ${i + 1} of ${STEPS.length}`);
    await act();
  }
  await enter(tour(page).getByRole("button", { name: "Finish", exact: true }));
  await expect(tour(page)).toBeHidden();
  await focusIs(page, ABRAHAM);
});

test.describe("a first visit", () => {
  // A new browser: nothing kept, so the tour is offered (the other specs start with it offered).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the tour is offered until answered, a skip is remembered, and the footer restarts it", async ({ page }) => {
    // The first Focus is Jesus Christ (decision 186), whom the tour studies.
    await page.goto("/");
    await focusIs(page, JESUS);
    await expect(tour(page)).toContainText("studying Jesus Christ");
    // Offered until answered: a reload before an answer offers it again.
    await page.reload();
    await focusIs(page, JESUS);
    await tour(page).getByRole("button", { name: "Skip" }).click();
    await expect(tour(page)).toBeHidden();
    await page.reload();
    await focusIs(page, JESUS);
    await expect(tour(page)).toBeHidden();

    await help(page).click();
    await expect(tour(page)).toContainText(`Step 1 of ${STEPS.length}`);
    await tour(page).getByRole("button", { name: "End tour" }).click();
    await expect(tour(page)).toBeHidden();

    // Taken from the offer.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await tour(page).getByRole("button", { name: "Take the tour" }).click();
    await expect(tour(page)).toContainText(`Step 1 of ${STEPS.length}`);
  });
});
