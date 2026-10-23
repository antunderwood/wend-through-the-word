import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";
import { doubleTap } from "../touch";

// On a phone the reader is the Reader tab of the bottom sheet, beside Details (decision 127).
const ABRAHAM = "person:abraham_58";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });
const readerTab = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Reader" });
const reader = (page: Page) => readerTab(page).getByRole("region", { name: "Reader" });
const verse = (page: Page, ref: string) => reader(page).getByRole("button", { name: ref, exact: true });

test.use({ reducedMotion: "reduce" });

// The hint, dismissed before in this browser, would lie over the top of the scene on a phone.
async function open(page: Page, path = "/") {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page, path);
}

// Selects a Verse from Abraham's Verse list, then taps Read.
async function readFromList(page: Page, ref: string) {
  await details(page).getByRole("list", { name: /^Verse/ }).getByRole("button", { name: new RegExp(`^${ref}`) }).tap();
  await expect(details(page).getByRole("heading", { level: 2 })).toHaveText(ref);
  await details(page).getByRole("button", { name: "Read", exact: true }).tap();
}

test("Read opens the Reader tab at the Selected Verse's chapter; a tap on a verse selects it, a double tap makes it the Focus", async ({ page }) => {
  await open(page);
  await focusIs(page, ABRAHAM);
  // Fixture: Gen 11:31 is one of Abraham's Verses.
  await readFromList(page, "Gen 11:31");
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  await expect(details(page)).toBeHidden();
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(verse(page, "Gen 11:31")).toHaveAttribute("aria-current", "true");
  await expect(verse(page, "Gen 11:31")).toBeInViewport();
  // The drawer of the desktop is not drawn as well, and the tab has no close button.
  await expect(page.getByRole("region", { name: "Reader" })).toHaveCount(1);
  await expect(reader(page).getByRole("button", { name: "Close reader" })).toHaveCount(0);

  await verse(page, "Gen 11:27").tap();
  await expect(verse(page, "Gen 11:27")).toHaveAttribute("aria-current", "true");
  await focusIs(page, ABRAHAM);
  // Details shows it, and the Reader tab keeps its place.
  await sheet(page).getByRole("tab", { name: "Details" }).tap();
  await expect(details(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  await expect(verse(page, "Gen 11:27")).toBeInViewport();

  await verse(page, "Gen 11:26").scrollIntoViewIfNeeded();
  const box = (await verse(page, "Gen 11:26").boundingBox())!;
  await doubleTap(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await focusIs(page, "01011026");
  await expect(verse(page, "Gen 11:26")).toHaveAttribute("aria-current", "true");
});

test("on a phone the whole verse is the target: a tap on its words selects it, a double tap makes it the Focus", async ({ page }) => {
  await open(page);
  await focusIs(page, ABRAHAM);
  await readFromList(page, "Gen 11:31");
  // The verse is the size of its words, far larger than a verse number.
  const line = verse(page, "Gen 11:29");
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThan(200);
  // A tap on its words, far from its number.
  await expect(line).toContainText("Milcah");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(line).toHaveAttribute("aria-current", "true");
  await focusIs(page, ABRAHAM);

  const other = verse(page, "Gen 11:30");
  await other.scrollIntoViewIfNeeded();
  const b = (await other.boundingBox())!;
  await doubleTap(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await focusIs(page, "01011030");
});

test("Read on an Entity opens the Reader tab at the chapter of its first linked Verse, with the sheet open", async ({ page }) => {
  await open(page);
  await focusIs(page, ABRAHAM);
  await sheet(page).getByRole("button", { name: "Close the sheet" }).tap();
  // Read is reached through the keyboard here: the closed sheet hides it from a finger.
  await details(page).getByRole("button", { name: "Read", exact: true }).dispatchEvent("click");
  await expect(sheet(page).getByRole("button", { name: "Close the sheet" })).toBeVisible();
  // Fixture: Abraham's first Verse in Bible order is Gen 11:26.
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(verse(page, "Gen 11:26")).toBeInViewport();
});

test("previous and next chapter work in the Reader tab", async ({ page }) => {
  await open(page, "/?focus=01011031");
  await focusIs(page, "01011031");
  // A Verse Focus opens the reader, as on a desktop; the sheet stays on Details until a tap.
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  const previous = reader(page).getByRole("button", { name: "Previous chapter" });
  const next = reader(page).getByRole("button", { name: "Next chapter" });
  // The fixture builds Gen 11, 16, 25, 26, 36, Matt 1, 2, 16, 17, John 1, 3 John 1.
  await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
  await expect(previous).toBeDisabled();
  await next.tap();
  await expect(reader(page).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  await next.tap();
  await expect(reader(page).getByRole("heading", { name: "Genesis 25" })).toBeVisible();
  await previous.tap();
  await expect(reader(page).getByRole("heading", { name: "Genesis 16" })).toBeVisible();
  // Moving through chapters changes neither the Focus nor the selection.
  await focusIs(page, "01011031");
  await sheet(page).getByRole("tab", { name: "Details" }).tap();
  await expect(details(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:31");
});

test("the sheet opens at the tab last used in this browser", async ({ page }) => {
  await open(page);
  await focusIs(page, ABRAHAM);
  await sheet(page).getByRole("tab", { name: "Reader" }).tap();
  // Nothing is open in the reader yet: the tab says how to open a chapter.
  await expect(readerTab(page)).toContainText("Read, in Details, opens the chapter of the Selected Verse here.");

  await page.reload();
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  await expect(readerTab(page)).toBeVisible();

  await sheet(page).getByRole("tab", { name: "Details" }).tap();
  await page.reload();
  await focusIs(page, ABRAHAM);
  await expect(sheet(page).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await expect(details(page)).toBeVisible();
});
