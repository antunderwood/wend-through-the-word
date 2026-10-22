import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, themesOnScreen } from "../scene";
import { doubleTap } from "../touch";
import { selectedIs, tappable } from "../touch-input";

// The student journey on a phone, by touch alone: search, select, make Focus, pin, Your Path, a
// note, the filters, and the Reader tab, then the shared link opened on another phone.
const ABRAHAM = "person:abraham_58",
  ISAAC = "person:isaac_616";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });
const heading = (page: Page) => details(page).getByRole("heading", { level: 2 });
const reader = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Reader" }).getByRole("region", { name: "Reader" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
const roleOf = async (page: Page, id: string) => (await nodes(page)).find((n) => n.id === id)?.role;

test.use({ reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });

test("the student journey by touch, and its shared link opened on another phone", async ({ page, browser }) => {
  test.slow(); // the whole journey, then a second phone loads the link
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await focusIs(page, ABRAHAM);

  // Search from the button: Isaac is the Focus and search closes.
  await page.getByRole("button", { name: "Search" }).tap();
  await page.keyboard.type("Isaac");
  await page.getByRole("list", { name: "Search results" }).getByRole("button").first().tap();
  await focusIs(page, ISAAC);
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeHidden();
  await expect(bar(page).getByRole("listitem")).toHaveText(["Isaac", "Abraham"]);

  // A note on the Focus, typed with the on-screen keyboard.
  const note = details(page).getByRole("textbox", { name: /^Note on Isaac/ });
  await note.tap();
  await page.keyboard.type("The son of the promise.");
  await expect(note).toHaveValue("The son of the promise.");

  // A tap on a node in the scene selects it; a double tap makes it the Focus.
  const target = await tappable(page);
  await page.touchscreen.tap(target.x, target.y);
  await selectedIs(page, target.id);
  const name = (await heading(page).textContent())!;
  await doubleTap(page, target);
  await focusIs(page, target.id);
  await expect(bar(page).getByRole("listitem").first()).toHaveText(name);

  // Your Path: a tap on Abraham selects him, and Pin pins him.
  await bar(page).getByRole("button", { name: "Abraham", exact: true }).tap();
  await expect(heading(page)).toHaveText("Abraham");
  await details(page).getByRole("button", { name: "Pin", exact: true }).tap();
  await expect(page.getByRole("status")).toHaveText("Pinned Abraham.");
  await expect.poll(() => roleOf(page, ABRAHAM)).toBe("pinned");

  // Prev and Next walk Your Path; Make Focus takes Isaac back, and his note is still there.
  await details(page).getByRole("button", { name: "Next", exact: true }).tap();
  await expect(heading(page)).toHaveText("Isaac");
  await details(page).getByRole("button", { name: "Make Focus", exact: true }).tap();
  await focusIs(page, ISAAC);
  await expect(details(page).getByRole("textbox", { name: /^Note on Isaac/ })).toHaveValue("The son of the promise.");

  // Themes off in the filters at the end of the Details tab.
  const filters = details(page).getByRole("group", { name: "Filters" });
  await filters.scrollIntoViewIfNeeded();
  await filters.getByRole("checkbox", { name: "Themes" }).tap();
  await expect.poll(() => themesOnScreen(page)).toBe(0);

  // One of Isaac's Verses, read in the Reader tab; a tap on another verse there selects it.
  const row = details(page).getByRole("list", { name: /^Verse/ }).getByRole("button").first();
  await row.scrollIntoViewIfNeeded();
  await row.tap();
  await details(page).getByRole("button", { name: "Read", exact: true }).tap();
  await expect(sheet(page).getByRole("tab", { name: "Reader" })).toHaveAttribute("aria-selected", "true");
  const key = (await reader(page).locator("[data-key]:not([aria-current='true'])").first().getAttribute("data-key"))!;
  const other = reader(page).locator(`[data-key="${key}"]`);
  await other.scrollIntoViewIfNeeded();
  await other.tap();
  await expect(other).toHaveAttribute("aria-current", "true");
  await focusIs(page, ISAAC);
  await expect.poll(() => new URL(page.url()).searchParams.get("sel")).toBeTruthy();
  const verse = (await other.getAttribute("aria-label"))!;

  // Copy link, then open it on another phone, which has never seen this journey.
  await page.getByRole("button", { name: "Copy link" }).tap();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const elsewhere = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, reducedMotion: "reduce" });
  const phone = await elsewhere.newPage();
  await phone.goto(link);
  await focusIs(phone, ISAAC);
  await expect(heading(phone)).toHaveText(verse);
  expect(await roleOf(phone, key)).not.toBe("focus");
  await expect.poll(() => roleOf(phone, ABRAHAM)).toBe("pinned");
  expect(await themesOnScreen(phone)).toBe(0);
  await expect(details(phone).getByRole("group", { name: "Filters" }).getByRole("checkbox", { name: "Themes" })).not.toBeChecked();
  await elsewhere.close();
});
