import { expect, test, type Page } from "@playwright/test";
import { doubleClickLabel, focusIs, openOnAbraham } from "./scene";

const SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348";

test.use({ reducedMotion: "reduce" });

test("the Your Path bar shows the Focus then Your Path newest first, and can be cleared and restored", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const bar = page.getByRole("navigation", { name: "Your Path" });
  const items = bar.getByRole("listitem");
  await expect(items).toHaveText(["Abraham"]);

  // Two Foci: Sarah from Abraham's Ring 1, then Hagar from Sarah's.
  await doubleClickLabel(page, "Sarah", SARAH);
  await doubleClickLabel(page, "Hagar", HAGAR);
  await expect(items).toHaveText(["Hagar", "Sarah", "Abraham"]);

  // A click selects without moving the Focus; Next steps towards the Focus.
  const panel = page.getByRole("complementary", { name: "Selected Node" });
  await items.getByText("Abraham").click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await panel.getByRole("button", { name: "Prev", exact: true }).click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await focusIs(page, HAGAR);

  await bar.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(items).toHaveText(["Hagar"]);
  // Abraham is also in Hagar's Ring 1, so he is still in the scene and stays selected.
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");

  await bar.getByRole("button", { name: "Undo clear" }).click();
  await expect(items).toHaveText(["Hagar", "Sarah", "Abraham"]);
});

// A double click on a step makes it the Focus (decision 206): two clicks on one step within the
// app's 400 ms, timed as the scene times them, whatever the bar redraws between them.
test.describe("a double click on a step", () => {
  const ABRAHAM = "person:abraham_58";
  const items = (page: Page) => page.getByRole("navigation", { name: "Your Path" }).getByRole("listitem");
  const heading = (page: Page) => page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 });
  // Long enough for a Focus that should not move, but did, to load and show. Nothing on the page
  // marks that it did not, so this wait is fixed; a slow runner can only make it miss a fault,
  // never fail a page that works.
  const settle = (page: Page) => page.waitForTimeout(1000);
  // A double click on a step, its two clicks dispatched in the page one after the other, with the bar
  // redrawn between them, so the page's own clock times them and a runner slowed by software WebGL
  // cannot spread them past the app's 400 ms (Playwright's dblclick waits on the browser between its
  // presses). Each click's detail counts the clicks, as the browser's own does.
  const doubleClick = (page: Page, name: string) =>
    items(page)
      .getByRole("button", { name, exact: true })
      .evaluate(async (step) => {
        const click = (detail: number) => step.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail }));
        click(1);
        await Promise.resolve(); // the bar redraws
        click(2);
      });

  // Abraham, then Sarah, then Hagar, kept in this browser: the bar reads Hagar, Sarah, Abraham.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (kept) => localStorage.getItem("wend.journey") || localStorage.setItem("wend.journey", kept),
      JSON.stringify({ focus: HAGAR, path: [ABRAHAM, SARAH] }),
    );
    await page.goto("/");
    await focusIs(page, HAGAR);
    await expect(items(page)).toHaveText(["Hagar", "Sarah", "Abraham"]);
  });

  test("on an earlier step makes it the Focus, and Your Path keeps its steps", async ({ page }) => {
    await doubleClick(page, "Abraham");
    await focusIs(page, ABRAHAM);
    await expect(page).toHaveURL(/focus=person:abraham_58/);
    await expect(heading(page)).toHaveText("Abraham");
    await expect(items(page)).toHaveText(["Abraham", "Hagar", "Sarah"]);
  });

  test("a single click only selects, as do two clicks further apart than the double click time", async ({ page }) => {
    const abraham = items(page).getByText("Abraham");
    await abraham.click();
    await expect(heading(page)).toHaveText("Abraham");
    await page.waitForTimeout(700); // well past the 400 ms, however slow the runner
    await abraham.click();
    await settle(page);
    await focusIs(page, HAGAR);
    await expect(heading(page)).toHaveText("Abraham");
    await expect(items(page)).toHaveText(["Hagar", "Sarah", "Abraham"]);
  });

  test("on the Focus's own step changes nothing", async ({ page }) => {
    const url = page.url();
    await doubleClick(page, "Hagar");
    await settle(page);
    await focusIs(page, HAGAR);
    expect(page.url()).toBe(url);
    await expect(items(page)).toHaveText(["Hagar", "Sarah", "Abraham"]);
  });

  for (const key of ["Enter", "Space"])
    test(`the keyboard still only selects, even with ${key} pressed twice quickly`, async ({ page }) => {
      await items(page).getByRole("button", { name: "Abraham" }).focus();
      await page.keyboard.press(key);
      await page.keyboard.press(key);
      await expect(heading(page)).toHaveText("Abraham");
      await settle(page);
      await focusIs(page, HAGAR);
    });
});
