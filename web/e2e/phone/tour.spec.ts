import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";
import { drag } from "../touch";
import { STEPS } from "../../src/tour";

// The tour on a phone (docs/specs/mobile.md): the same steps as on a desktop (e2e/tour.spec.ts).
// Before each step the tour sets the sheet as the step's target needs and scrolls the target into
// view (decision 185): a name in the scene closes the sheet, a target in the sheet opens it at its
// tab, and the box covers neither the target nor the sheet. Upright and on its side.
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

// The owner's phone in Chrome, upright and on its side, and a larger phone.
const OWNER = { width: 325, height: 600 },
  OWNER_SIDEWAYS = { width: 760, height: 330 },
  UPRIGHT = { width: 390, height: 844 };

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
// What the tour must leave as it was: the address, Your Path, the Selected Node, the sheet open or
// closed and its tab, and everything kept in this browser.
const state = async (page: Page) => ({
  address: new URL(page.url()).search,
  path: await bar(page).getByRole("listitem").allTextContents(),
  selected: await page.getByRole("complementary", { name: "Selected Node", includeHidden: true }).getByRole("heading", { level: 2, includeHidden: true }).textContent(),
  open: await sheet(page).getByRole("button", { name: /the sheet$/ }).getAttribute("aria-expanded"),
  tab: await sheet(page).getByRole("tab", { selected: true }).textContent(),
  kept: await page.evaluate(() => ({ ...localStorage })),
  history: await page.evaluate(() => history.length),
});

// The step's target, the element the ring is drawn round, is on screen and nothing lies over it
// (its middle, or its first row when it is a long list); a name in the scene has the sheet closed,
// a target in the sheet has it open; and the box is on screen, clear of the target and the sheet.
// A name in the scene is marked with its node's disc, which the reader taps: the ring goes round
// both, and nothing but the scene lies over the disc's centre. The problems found, none when the
// step is shown as it should be.
const problems = (page: Page) =>
  page.evaluate(() => {
    const ring = document.querySelector(".tour-target") as HTMLElement;
    if (ring.hidden) return "no ring";
    const at = ring.getBoundingClientRect(),
      box = document.querySelector('[role="dialog"][aria-label="Tour"]')!.getBoundingClientRect();
    const sheetEl = document.querySelector('[data-tour="sheet"]')!,
      sheet = sheetEl.getBoundingClientRect();
    const open = sheetEl.querySelector('[aria-controls="sheet-body"]')!.getAttribute("aria-expanded") === "true";
    const scene = document.querySelector('[data-tour="scene"]')!;
    const disc = (e: Element) => (scene.contains(e) && e.getAttribute("data-node") ? window.wendGraph!.nodeRect(e.getAttribute("data-node")!) : null);
    // The element's box; for a name in the scene, its node's disc and the name when shown.
    const marked = (e: Element) => {
      const d = disc(e);
      if (!d) return e.getBoundingClientRect();
      if (!e.checkVisibility({ visibilityProperty: true })) return d;
      const r = e.getBoundingClientRect();
      const left = Math.min(r.left, d.left),
        top = Math.min(r.top, d.top);
      return new DOMRect(left, top, Math.max(r.right, d.right) - left, Math.max(r.bottom, d.bottom) - top);
    };
    const near = (a: number, b: number) => Math.abs(a - b) <= 1.5;
    const target = [...document.querySelectorAll("[data-tour], [data-node]")].find((e) => {
      const r = marked(e);
      return r.width > 0 && near(r.left - 5, at.left) && near(r.top - 5, at.top) && Math.abs(at.width - r.width - 10) <= 5 && Math.abs(at.height - r.height - 10) <= 5;
    });
    if (!target) return "no target under the ring";
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + Math.min(r.height / 2, 20);
    const apart = (a: DOMRect, b: DOMRect) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
    const found: string[] = [];
    const name = target.getAttribute("data-tour") ?? target.getAttribute("data-node");
    if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) found.push(`${name} off screen`);
    else if (!target.contains(document.elementFromPoint(x, y))) found.push(`${name} covered by ${document.elementFromPoint(x, y)?.outerHTML.slice(0, 60)}`);
    const d = disc(target);
    if (d) {
      const [dx, dy] = [d.left + d.width / 2, d.top + d.height / 2];
      if (dx < 0 || dx > innerWidth || dy < 0 || dy > innerHeight) found.push(`${name}'s disc off screen`);
      else if (!scene.contains(document.elementFromPoint(dx, dy))) found.push(`${name}'s disc covered by ${document.elementFromPoint(dx, dy)?.outerHTML.slice(0, 60)}`);
    }
    if (target.closest('[data-tour="scene"]') && open) found.push(`${name}: the sheet is open`);
    if (sheetEl.contains(target) && !open) found.push(`${name}: the sheet is closed`);
    if (!apart(box, at)) found.push(`the box is over ${name}`);
    if (!apart(box, sheet)) found.push("the box is over the sheet");
    if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) found.push("the box is off screen");
    return found.join("; ");
  });
const shown = (page: Page) => expect.poll(() => problems(page)).toBe("");

for (const [size, view] of [
  [OWNER, "A"],
  [OWNER, "C"],
  [OWNER_SIDEWAYS, "A"],
] as const) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test(`Do it for me passes every step, each shown in full, and the reader's state comes back, in view ${view}`, async ({ page }) => {
      await reader(page, view);
      const sent: string[] = [];
      page.on("request", (r) => (r.method() !== "GET" || !new URL(r.url()).pathname.startsWith("/data/")) && sent.push(`${r.method()} ${r.url()}`));

      const before = await state(page);
      await help(page).tap();
      for (let n = 1; n <= STEPS.length; n++) {
        await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
        await shown(page);
        await tour(page).getByRole("button", { name: "Do it for me" }).tap();
      }
      await expect(tour(page)).toContainText("Done");
      // Nothing kept in this browser while it ran: the sheet's tab and the note included.
      expect((await state(page)).kept).toEqual(before.kept);
      await tour(page).getByRole("button", { name: "Finish", exact: true }).tap();
      await expect(tour(page)).toBeHidden();
      await focusIs(page, SARAH);
      // The tour closed the sheet and opened the Reader tab; the open sheet and Details come back.
      expect(await state(page)).toEqual(before);
      expect(sent).toEqual([]);
    });
  });
}

// A point on the scene's own canvas that nothing lies over: not a name, the tour box, or a control.
async function bare(page: Page) {
  const s = (await scene(page).boundingBox())!;
  const point = await page.evaluate(
    ([x0, y0, x1, y1]) => {
      for (let y = y0 + 20; y < y1 - 20; y += 20)
        for (let x = x0 + 20; x < x1 - 20; x += 20) if (document.elementFromPoint(x, y)?.matches('[data-tour="scene"] canvas')) return { x, y };
    },
    [s.x, s.y, s.x + s.width, s.y + s.height],
  );
  expect(point).toBeDefined();
  return point!;
}
const search = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Search", exact: true }).tap();
  await page.getByRole("searchbox", { name: "Search" }).fill(name);
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
};
// The reader's own action for each step, by touch, on what the tour shows.
const BY_TOUCH: ((page: Page) => Promise<unknown>)[] = [
  async (page) => {
    const from = await bare(page);
    await drag(page, from, { x: from.x + 60, y: from.y });
  },
  (page) => search(page, "Jesus Christ"),
  // The camera stopped when the finger lifted, so a name holds still to be tapped.
  (page) => scene(page).locator(`[data-node="${GOD}"]`).tap(),
  (page) => scene(page).locator(`[data-node="${JESUS}"]`).tap(),
  (page) => details(page).getByRole("button", { name: "27 more" }).tap(),
  (page) => details(page).getByRole("list", { name: /^Theme/ }).getByRole("button", { name: /^Miracles/ }).tap(),
  (page) => search(page, "Simon Peter"),
  // A tap on Jesus Christ in Your Path makes Pin the target, and the tour opens the sheet at it.
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

for (const [size, view] of [
  [OWNER, "A"],
  [OWNER_SIDEWAYS, "A"],
] as const) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.use({ viewport: size });

    test(`the reader's own touch actions pass every step and a kept note stays, in view ${view}`, async ({ page }) => {
      await reader(page, view);
      const before = await state(page);
      await help(page).tap();
      for (const [i, act] of BY_TOUCH.entries()) {
        await expect(tour(page)).toContainText(`Step ${i + 1} of ${STEPS.length}`);
        await shown(page);
        await act(page);
      }
      await expect(tour(page)).toContainText("Done");
      await tour(page).getByRole("button", { name: "Finish and keep my note" }).tap();
      await focusIs(page, SARAH);
      const notes = JSON.stringify({ [ABRAHAM]: "My own note.", [PETER]: "Peter, the rock." });
      expect(await state(page)).toEqual({ ...before, kept: { ...before.kept, "wend.notes": notes } });
    });
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
  await shown(page);
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  await expect(tour(page)).toContainText(`Step 6 of ${STEPS.length}`);
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await shown(page);
});

test("a step in the sheet scrolls its target into view, below the actions held at the top", async ({ page }) => {
  await reader(page, "A");
  await help(page).tap();
  for (let n = 1; n <= 4; n++) {
    await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
    await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  }
  // The reader scrolls the Details tab back to its top, far above Jesus Christ's Themes.
  await expect(tour(page)).toContainText(`Step 5 of ${STEPS.length}`);
  await shown(page);
  await details(page).locator("#panel").evaluate((p) => p.scrollTo(0, 0));
  const themes = details(page).getByRole("list", { name: /^Theme/ });
  await expect(themes).not.toBeInViewport();
  // The next step points at them: the tour scrolls them into view.
  await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  await expect(tour(page)).toContainText(`Step 6 of ${STEPS.length}`);
  await shown(page);
  await expect(themes).toBeInViewport();
});

test("a tour taken from the offer on a closed sheet's Reader tab gives both back when it ends", async ({ page }) => {
  // A browser not yet offered the tour, whose sheet was left on its Reader tab.
  await page.addInitScript(() => {
    localStorage.removeItem("wend.tourOffered");
    localStorage.setItem("wend.sheetTab", "reader");
  });
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
  await expect(tour(page)).toContainText("studying Jesus Christ");
  await tour(page).getByRole("button", { name: "Take the tour" }).tap();
  for (let n = 1; n <= 4; n++) {
    await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
    await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  }
  // Jesus Christ's Themes are in the Details tab, which the tour opens.
  await expect(tour(page)).toContainText(`Step 5 of ${STEPS.length}`);
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await shown(page);
  await tour(page).getByRole("button", { name: "End tour" }).tap();
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("button", { name: "Open the sheet" })).toBeVisible();
  await expect(sheet(page).getByRole("tab", { name: "Reader", includeHidden: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => localStorage.getItem("wend.sheetTab"))).toBe("reader");
});

test("a sheet dragged to nearly the whole screen is half open during the tour and full again when it ends", async ({ page }) => {
  await reader(page, "A");
  const shownPx = async () => UPRIGHT.height - (await sheet(page).boundingBox())!.y;
  const b = (await sheet(page).getByRole("button", { name: "Close the sheet" }).boundingBox())!;
  await drag(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2, y: b.y - 250 });
  const full = UPRIGHT.height - 40 - 80; // all but the top bar and a strip of the scene
  await expect.poll(shownPx).toBeCloseTo(full, 0);
  await help(page).tap();
  // The first steps' targets are in the scene, so the tour closes the sheet; the fifth's is in it,
  // so the tour opens it, at half.
  await expect(tour(page)).toContainText(`Step 1 of ${STEPS.length}`);
  await expect(sheet(page).getByRole("button", { name: "Open the sheet" })).toBeVisible();
  for (let n = 1; n <= 4; n++) {
    await expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
    await tour(page).getByRole("button", { name: "Do it for me" }).tap();
  }
  await expect(tour(page)).toContainText(`Step 5 of ${STEPS.length}`);
  await expect.poll(shownPx).toBeCloseTo(UPRIGHT.height * 0.46, 0);
  await tour(page).getByRole("button", { name: "End tour" }).tap();
  await focusIs(page, SARAH);
  await expect.poll(shownPx).toBeCloseTo(full, 0);
});
