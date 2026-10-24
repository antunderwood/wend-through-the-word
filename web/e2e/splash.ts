import { expect, type Page } from "@playwright/test";

// The splash's shared steps, for the desktop and phone specs. Every other spec starts in a browser
// that has seen the splash (playwright.config.ts).
export const splash = (page: Page) => page.getByRole("dialog", { name: "Wend Through the Word" });
export const start = (page: Page) => splash(page).getByRole("button", { name: "Start exploring" });
export const takeTour = (page: Page) => splash(page).getByRole("button", { name: "Take the tour" });

// A first visit: on the first load only, the splash's flag is cleared and `kept` is set in this
// browser, so a reload is a second visit. One script does both, so no other script's order matters.
export async function firstVisit(page: Page, kept: Record<string, string> = {}) {
  await page.addInitScript((kept) => {
    if (sessionStorage.getItem("firstVisit")) return;
    sessionStorage.setItem("firstVisit", "1");
    localStorage.removeItem("wend.splashSeen");
    for (const [key, value] of Object.entries(kept)) localStorage.setItem(key, value);
  }, kept);
}

// The data waits until the returned function is called, so a spec can act before the page has it.
export async function holdData(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/data/**", async (route) => (await held, route.continue()));
  return release;
}

// The splash is whole in the window with nothing to scroll, and each button is large enough to tap.
export async function fits(page: Page) {
  const { width, height } = page.viewportSize()!;
  const card = (await splash(page).boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(width);
  expect(card.y + card.height).toBeLessThanOrEqual(height);
  expect(await splash(page).evaluate((d) => d.scrollHeight <= d.clientHeight && d.scrollWidth <= d.clientWidth)).toBe(true);
  for (const button of await splash(page).getByRole("button").all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}
