import { expect, test, type Page } from "@playwright/test";

const ABRAHAM = "person:abraham_58",
  ISAAC = "person:isaac_616";
const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id, { polling: "raf" });
const heading = (page: Page) => page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 });

test.use({ reducedMotion: "reduce" });

test("arrows step the Selected Node through Ring 1, Enter makes it the Focus, Backspace goes back", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  const before = await page.evaluate(() => window.wendGraph!.testNodes());

  // Fixture: Abraham's Ring 1 starts with his People by weight (Isaac, then Sarah) and ends with
  // the Overflow Node for his 20 further Verses.
  await page.keyboard.press("ArrowRight");
  await expect(heading(page)).toHaveText("Isaac");
  await expect(page.locator(".nl.ring1.selected")).toHaveText("Isaac");
  await page.keyboard.press("ArrowDown");
  await expect(heading(page)).toHaveText("Sarah");
  await page.keyboard.press("ArrowLeft");
  await expect(heading(page)).toHaveText("Isaac");
  await page.keyboard.press("ArrowUp");
  await expect(heading(page)).toHaveText("+20 verses");
  await page.keyboard.press("ArrowRight");
  await expect(heading(page)).toHaveText("Isaac");
  // Selecting never changes the scene.
  expect(await page.evaluate(() => window.wendGraph!.testNodes())).toEqual(before);

  await page.keyboard.press("Enter");
  await focusIs(page, ISAAC);
  const bar = page.getByRole("navigation", { name: "Your Path" }).getByRole("button");
  await expect(bar).toHaveText(["Isaac", "Abraham", "Clear"]);

  await page.keyboard.press("Backspace");
  await focusIs(page, ABRAHAM);
  await expect(bar).toHaveText(["Abraham", "Isaac", "Clear"]);
});

test("scene keys leave the view picker and the search box alone", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  const picker = page.getByRole("radiogroup", { name: "View" });

  // On the picker, Right changes the view and not the selection.
  await picker.getByRole("radio", { name: "Tilted plane" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(picker.getByRole("radio", { name: "Stacked discs" })).toBeChecked();
  await expect(heading(page)).toHaveText("Abraham");

  // On the scene, Right changes the selection and not the view.
  await page.locator(".stage").focus();
  await page.keyboard.press("ArrowRight");
  await expect(heading(page)).toHaveText("Isaac");
  await expect(picker.getByRole("radio", { name: "Stacked discs" })).toBeChecked();

  // In the search box, Enter chooses a result and Backspace edits the text.
  const search = page.getByRole("searchbox", { name: "Search" });
  await search.fill("Sarah");
  await search.press("Backspace");
  await expect(search).toHaveValue("Sara");
  await expect(heading(page)).toHaveText("Isaac");
});

test("controls show keyboard focus and have text names", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
  for (const b of await page.getByRole("button").all()) expect((await b.getAttribute("aria-label")) || (await b.textContent())!.trim()).not.toBe("");
});
