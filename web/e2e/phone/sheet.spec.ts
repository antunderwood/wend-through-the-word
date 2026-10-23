import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes } from "../scene";
import { doubleTap } from "../touch";

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
    await page.getByRole("button", { name: "Search" }).tap();
    await search.fill(name);
    await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
    await expect(page.getByRole("tabpanel", { name: "Details" }).getByRole("heading", { level: 2 })).toHaveText(new RegExp(`^${name}`));
  }
  const bar = page.getByRole("navigation", { name: "Your Path" });
  const steps = bar.getByRole("listitem");
  await expect(steps).toHaveCount(7);
  // One row across the screen, the slim top bar (decision 183), every step nearly as tall as the
  // bar; the steps run on past its edge, and Clear stays in view.
  const box = (await bar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.height).toBeLessThanOrEqual(44);
  for (const step of await steps.all()) {
    const b = (await step.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(34);
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

test("the arrow keys, Home, and End move between the sheet's tabs, as in a tab list", async ({ page }) => {
  await open(page);
  const tabs = page.getByRole("region", { name: "Sheet" }).getByRole("tablist", { name: "Sheet" });
  const details = tabs.getByRole("tab", { name: "Details" }),
    reader = tabs.getByRole("tab", { name: "Reader" });
  // The open tab has the keyboard and is the only tab in the Tab order.
  const at = async (open: typeof details, closed: typeof details) => {
    await expect(open).toBeFocused();
    await expect(open).toHaveAttribute("aria-selected", "true");
    await expect(open).toHaveAttribute("tabindex", "0");
    await expect(closed).toHaveAttribute("aria-selected", "false");
    await expect(closed).toHaveAttribute("tabindex", "-1");
  };
  await details.focus();
  await page.keyboard.press("ArrowRight");
  await at(reader, details);
  await page.keyboard.press("ArrowRight"); // round to the first
  await at(details, reader);
  await page.keyboard.press("ArrowLeft"); // round to the last
  await at(reader, details);
  await page.keyboard.press("Home");
  await at(details, reader);
  await page.keyboard.press("End");
  await at(reader, details);
  expect(await page.evaluate(() => localStorage.getItem("wend.sheetTab"))).toBe("reader");
});

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
  await doubleTap(page, { x: before.x + before.width / 2, y: before.y + before.height / 2 });
  const between = await page.evaluate(() => (window as unknown as { between: DOMRect }).between);
  expect({ x: between.x, y: between.y, width: between.width, height: between.height }).toEqual(before);
  await focusIs(page, "person:isaac_616");
  await expect(details.getByRole("heading", { level: 2 })).toHaveText("Isaac");
});

// Each of the Selected Node's actions is drawn whole on screen and nothing lies over its middle.
const ACTIONS = ["Make Focus", "Pin", "Prev", "Next", "Read", "Suggest a correction"];
async function actionsInReach(page: Page) {
  const details = page.getByRole("tabpanel", { name: "Details" });
  for (const name of ACTIONS) {
    const button = details.getByRole("button", { name, exact: true });
    await expect(button, name).toBeInViewport({ ratio: 1 });
    const b = (await button.boundingBox())!;
    expect(b.height, name).toBeGreaterThanOrEqual(44);
    expect(b.width, name).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate((e, p) => e.contains(document.elementFromPoint(p.x, p.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 }), name).toBe(true);
  }
}

test("the Selected Node's actions stay in view while its section or the lists scroll", async ({ page }) => {
  await open(page);
  await actionsInReach(page);
  // Abraham's section holds his journey note and his Dictionary Entry: far more than it shows.
  const section = page.getByRole("tabpanel", { name: "Details" }).getByRole("heading", { level: 2, name: "Abraham" }).locator("xpath=..");
  expect(await section.evaluate((s) => s.scrollHeight > s.clientHeight + 100)).toBe(true);
  await section.evaluate((s) => s.scrollTo(0, s.scrollHeight));
  await actionsInReach(page);
  // Down in the lists, past the section.
  const details = page.getByRole("tabpanel", { name: "Details" });
  await details.getByRole("list", { name: /^Verse/ }).getByRole("listitem").last().scrollIntoViewIfNeeded();
  await actionsInReach(page);
});
