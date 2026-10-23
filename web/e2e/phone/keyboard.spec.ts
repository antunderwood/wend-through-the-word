import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";

// The on-screen keyboard. A phone browser shows it over the bottom of the page and shrinks the
// visual viewport, not the page (Chrome's default, and Safari's). A browser test has no keyboard, so
// these specs shrink the visual viewport as one would, or the whole window as some browsers do.
const ABRAHAM = "person:abraham_58";
const KEYBOARD = 340;
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const note = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" }).getByRole("textbox", { name: /^Note on Abraham/ });

test.use({ reducedMotion: "reduce" });

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
}

// The keyboard comes up, or goes down: the visual viewport is that much shorter, as the browser reports it.
const keyboard = (page: Page, px: number) =>
  page.evaluate((px) => {
    Object.defineProperty(visualViewport, "height", { configurable: true, get: () => innerHeight - px });
    visualViewport!.dispatchEvent(new Event("resize"));
  }, px);

// Whether an element is whole within the visual viewport, above the keyboard.
const aboveKeyboard = (page: Page, l: ReturnType<typeof note>) =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= visualViewport!.offsetTop + visualViewport!.height;
  });

test("with the keyboard up the sheet sits above it, and the note being typed stays in view", async ({ page }) => {
  await open(page);
  await note(page).tap();
  await expect(note(page)).toBeFocused();
  await keyboard(page, KEYBOARD);
  await expect.poll(async () => {
    const b = (await sheet(page).boundingBox())!;
    return b.y + b.height;
  }).toBeLessThanOrEqual(844 - KEYBOARD + 1);
  await expect.poll(() => aboveKeyboard(page, note(page))).toBe(true);
  // The top bar stays on screen.
  await expect(page.getByRole("button", { name: "Search" })).toBeInViewport({ ratio: 1 });
  await page.keyboard.type("Called out of Ur.");
  await expect(note(page)).toHaveValue("Called out of Ur.");

  // The keyboard goes: the sheet is back at the bottom of the screen.
  await keyboard(page, 0);
  await expect.poll(async () => {
    const b = (await sheet(page).boundingBox())!;
    return Math.round(b.y + b.height);
  }).toBe(844);
});

test("when the keyboard shrinks the whole window, the note being typed stays in view", async ({ page }) => {
  await open(page);
  await note(page).tap();
  await expect(note(page)).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 - KEYBOARD });
  await expect.poll(() => aboveKeyboard(page, note(page))).toBe(true);
  await page.keyboard.type("Called out of Ur.");
  await expect(note(page)).toHaveValue("Called out of Ur.");
});
