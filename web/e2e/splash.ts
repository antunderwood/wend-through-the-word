import { expect, type Page } from "@playwright/test";

// The splash's shared steps, for the desktop and phone specs. Every other spec starts in a browser
// that has seen the splash (playwright.config.ts); these clear that on the first load only, so a
// reload is a second visit.
export const splash = (page: Page) => page.getByRole("dialog", { name: "Wend Through the Word" });
export const start = (page: Page) => splash(page).getByRole("button", { name: "Start exploring" });

export async function firstVisit(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("splash.spec")) return;
    sessionStorage.setItem("splash.spec", "1");
    localStorage.removeItem("wend.splashSeen");
  });
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
