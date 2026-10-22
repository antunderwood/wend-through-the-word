import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes } from "../scene";

const ABRAHAM = "person:abraham_58",
  GERAR = "place:gerar_459";
const node = async (page: Page, id: string) => (await nodes(page)).find((n) => n.id === id)!;

test.use({ reducedMotion: "reduce" });

// The hint, dismissed before in this browser, would lie over the top of the scene on a phone.
async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await focusIs(page, ABRAHAM);
}

test("a tap on a node shows its details in the bottom sheet, with every action", async ({ page }) => {
  await open(page);
  // The sheet opens on its Details tab, at 46% of the height, at the bottom of the screen.
  const sheet = page.getByRole("region", { name: "Sheet" });
  const box = (await sheet.boundingBox())!;
  expect(box.height).toBeCloseTo(844 * 0.46, 0);
  expect(box.y + box.height).toBeCloseTo(844, 0);
  await expect(sheet.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");

  // Gerar lies in the space above the sheet, clear of the search box.
  const gerar = await node(page, GERAR);
  await page.touchscreen.tap(gerar.x, gerar.y);
  const details = sheet.getByRole("tabpanel", { name: "Details" });
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Gerar");
  for (const name of ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"]) {
    await expect(details.getByRole("button", { name, exact: true })).toBeVisible();
  }
});

// Waits for a frame that draws the Focus at a height where(y) accepts.
const focusAt = (page: Page, where: (y: number) => boolean) =>
  expect.poll(async () => where((await nodes(page)).find((n) => n.role === "focus")!.y)).toBe(true);

test("the handle closes and opens the sheet, and the Focus stays in the space above it", async ({ page }) => {
  await open(page);
  const sheet = page.getByRole("region", { name: "Sheet" });
  const scene = (await page.getByRole("application").boundingBox())!;
  const top = (await sheet.boundingBox())!.y;
  // Open: the Focus is in the middle of the space between the top of the scene and the sheet.
  await focusAt(page, (y) => Math.abs(y - (scene.y + top) / 2) < 2);

  // Closed to its handle: the handle stays on screen, and the Focus is in the middle of the space above it.
  await sheet.getByRole("button", { name: "Close the sheet" }).tap();
  await expect(sheet.getByRole("tabpanel", { name: "Details" })).not.toBeInViewport();
  const handle = sheet.getByRole("button", { name: "Open the sheet" });
  await expect(handle).toBeInViewport({ ratio: 1 });
  const handleTop = (await handle.boundingBox())!.y;
  await focusAt(page, (y) => Math.abs(y - (scene.y + handleTop) / 2) < 2);

  await sheet.getByRole("button", { name: "Open the sheet" }).tap();
  await expect(sheet.getByRole("tabpanel", { name: "Details" })).toBeInViewport();
  await focusAt(page, (y) => Math.abs(y - (scene.y + top) / 2) < 2);
});

// The buttons and list rows of the sheet drawn less than 44 px tall, by their text.
const small = (page: Page) =>
  page.getByRole("region", { name: "Sheet" }).evaluate((sheet) =>
    [...sheet.querySelectorAll("button, li")]
      .filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 44)
      .map((e) => `${e.tagName} ${e.getAttribute("aria-label") ?? e.textContent!.trim().slice(0, 30)}: ${e.getBoundingClientRect().height}`),
  );

test("every button and list row in the sheet is at least 44 px tall", async ({ page }) => {
  await open(page);
  // The Focus, with its journey note, then Sarah, with her Relationship to Abraham.
  expect(await small(page)).toEqual([]);
  const details = page.getByRole("tabpanel", { name: "Details" });
  await details.getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).tap();
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await expect(details.getByText("Relationship: wife of Abraham")).toBeVisible();
  expect(await small(page)).toEqual([]);
});

test("Your Path is one row that scrolls sideways, with Clear at its end, and a tap on a step selects it", async ({ page }) => {
  await open(page);
  // Seven Foci by search: Abraham, then six more.
  const search = page.getByRole("searchbox", { name: "Search" });
  for (const name of ["Sarah", "Hagar", "Isaac", "Jacob", "Lot", "Nahor"]) {
    await search.fill(name);
    await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
    await expect(page.getByRole("tabpanel", { name: "Details" }).getByRole("heading", { level: 2 })).toHaveText(new RegExp(`^${name}`));
  }
  const bar = page.getByRole("navigation", { name: "Your Path" });
  const steps = bar.getByRole("listitem");
  await expect(steps).toHaveCount(7);
  // One row across the screen, every step 44 px tall; the steps run on past its edge, and Clear stays in view.
  const box = (await bar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  for (const step of await steps.all()) {
    const b = (await step.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height);
  }
  const list = bar.getByRole("list");
  expect(await list.evaluate((l) => l.scrollWidth > l.clientWidth)).toBe(true);
  await expect(bar.getByRole("button", { name: "Clear", exact: true })).toBeInViewport({ ratio: 1 });

  // The oldest step, Abraham, is past the edge: it scrolls into view and a tap selects it.
  await steps.last().getByRole("button").tap();
  await expect(page.getByRole("tabpanel", { name: "Details" }).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  expect(await list.evaluate((l) => l.scrollLeft)).toBeGreaterThan(0);
});

// Two taps 150 ms apart by their timestamps, which the browser reads to tell a double tap, so a slow
// test machine cannot turn them into two single taps.
async function doubleTap(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  const t = Date.now() / 1000;
  for (const [type, at] of [["touchStart", 0], ["touchEnd", 0.05], ["touchStart", 0.15], ["touchEnd", 0.2]] as const) {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }], timestamp: t + at });
  }
  await cdp.detach();
}

test("a double tap on a list row makes it the Focus, and the row does not move between the taps", async ({ page }) => {
  await open(page);
  const details = page.getByRole("tabpanel", { name: "Details" });
  const row = details.getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Isaac/ });
  await row.scrollIntoViewIfNeeded();
  const before = (await row.boundingBox())!;
  // The first tap selects Isaac and changes the Selected Node section above the lists; the row stays
  // where it was for the second tap. The page records where the row is once the first tap's change
  // is drawn (after the page's own click handler, whose update is queued first), so the second tap
  // can follow at once, as a reader's does.
  await row.evaluate((el) =>
    addEventListener("click", () => queueMicrotask(() => Object.assign(window, { between: el.getBoundingClientRect().toJSON() })), { once: true }),
  );
  await doubleTap(page, before.x + before.width / 2, before.y + before.height / 2);
  const between = await page.evaluate(() => (window as unknown as { between: DOMRect }).between);
  expect({ x: between.x, y: between.y, width: between.width, height: between.height }).toEqual(before);
  await focusIs(page, "person:isaac_616");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Isaac");
});
