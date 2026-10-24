import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";
import { firstVisit, fits, splash, start } from "./splash";

// The splash on a first visit (#98): a dialog named by its title, over the app, until Start
// exploring or Escape; then the app's own Focus (decision 186).
const JESUS = "person:jesus_905",
  ABRAHAM = "person:abraham_58";
const hint = (page: Page) => page.getByText("A click selects a node");
const inSplash = (page: Page) => splash(page).evaluate((d) => d.contains(document.activeElement));
// Whether each of the graphic's six discs has an animation (not under reduced motion).
const animations = (page: Page) => splash(page).locator("circle").evaluateAll((cs) => cs.map((c) => getComputedStyle(c).animationName !== "none"));

test("a first visit shows the splash before the data, and Start exploring opens Jesus Christ", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  // The data waits until the splash has been seen, so the splash cannot be waiting for it.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/data/**", async (route) => (await held, route.continue()));
  await firstVisit(page);
  await page.goto("/");

  await expect(splash(page)).toBeVisible();
  await expect(splash(page).getByRole("heading", { name: "Wend Through the Word" })).toBeVisible();
  await expect(splash(page)).toContainText("Explore the Bible as a 3D graph: start at a verse, a person, or a location, and move along the links.");
  await expect(splash(page).locator("svg")).toHaveAttribute("aria-hidden", "true");
  expect(await animations(page)).toEqual(Array(6).fill(true));
  await fits(page);
  // Focus starts on the first button and Tab keeps it inside.
  await expect(start(page)).toBeFocused();
  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    expect(await inSplash(page), key).toBe(true);
  }
  release();
  // The data loads behind it; the hint waits.
  await focusIs(page, JESUS);
  await expect(hint(page)).toBeHidden();

  await start(page).click();
  await expect(splash(page)).toBeHidden();
  await expect(page.getByRole("application")).toBeFocused();
  await expect(hint(page)).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect([...hosts]).toEqual([new URL(page.url()).host]);

  // A second visit in this browser.
  await page.reload();
  await focusIs(page, JESUS);
  await expect(hint(page)).toBeVisible();
  await expect(splash(page)).toBeHidden();
});

test("a shared link shows the splash first; a tap outside leaves it, Escape closes it on the link's Focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await firstVisit(page);
  await page.goto(`/?focus=${ABRAHAM}`);
  await expect(splash(page)).toBeVisible();
  expect(await animations(page)).toEqual(Array(6).fill(false));
  await page.mouse.click(4, 4);
  await expect(splash(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(splash(page)).toBeHidden();
  await focusIs(page, ABRAHAM);
  // At once: a reload straight after Escape is a second visit.
  await page.reload();
  await focusIs(page, ABRAHAM);
  await expect(splash(page)).toBeHidden();
});

test("with storage blocked the splash shows on each visit and works, with no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await start(page).click();
  await expect(splash(page)).toBeHidden();
  await focusIs(page, JESUS);
  await page.reload();
  await expect(splash(page)).toBeVisible();
  expect(errors).toEqual([]);
});
