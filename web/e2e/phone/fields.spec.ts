import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";

// A phone browser zooms in on a text field whose text is under 16 px, so on a phone every field is
// 16 px (decision 182): the search box, the note box, the filters, and any field added later.
const ABRAHAM = "person:abraham_58";

test.use({ reducedMotion: "reduce" });

// Every input, text area, and list of choices on the page drawn under 16 px, by its name.
const small = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => `${e.tagName} ${e.getAttribute("aria-label") ?? e.closest("label")?.textContent?.trim() ?? e.id}: ${getComputedStyle(e).fontSize}`),
  );

test("on a phone every text field and list of choices is 16 px", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  const details = page.getByRole("tabpanel", { name: "Details" });
  // The Focus's note box and the filters, with the book filter, are in the Details tab.
  await expect(details.getByRole("textbox", { name: /^Note on Abraham/ })).toBeAttached();
  await expect(details.getByRole("group", { name: "Filters" }).getByRole("combobox")).toBeAttached();
  await page.getByRole("button", { name: "Search" }).tap();
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeFocused();
  expect(await small(page)).toEqual([]);
});
