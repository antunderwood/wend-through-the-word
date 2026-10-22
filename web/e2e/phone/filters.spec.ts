import { expect, test, type Page } from "@playwright/test";
import { focusIs, themesOnScreen } from "../scene";

const ABRAHAM = "person:abraham_58";
const details = (page: Page) => page.getByRole("tabpanel", { name: "Details" });

test.use({ reducedMotion: "reduce" });

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
  await page.goto("/");
  await focusIs(page, ABRAHAM);
}

test("the filters in the Details tab hide a node type and change the Vote Limit, with the explanation shown", async ({ page }) => {
  await open(page);
  const filters = details(page).getByRole("group", { name: "Filters" });
  await filters.scrollIntoViewIfNeeded();
  await expect(filters).toBeInViewport();
  // No popover on a phone.
  await expect(page.getByRole("dialog", { name: "Filters" })).toHaveCount(0);

  expect(await themesOnScreen(page)).toBeGreaterThan(0);
  await filters.getByRole("checkbox", { name: "Themes" }).tap();
  await expect.poll(() => themesOnScreen(page)).toBe(0);
  await expect.poll(() => new URL(page.url()).search).toBe("?hide=theme");

  await expect(filters).toContainText("Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength.");
  await expect(filters).toContainText("With an Entity as the Focus, the slider only changes Ring 2.");
  await filters.getByRole("slider", { name: /^Vote Limit/ }).fill("5");
  await expect(filters).toContainText("Vote Limit: 5");
  await expect.poll(() => new URL(page.url()).searchParams.get("votes")).toBe("5");
});

test("the Filters button above the sheet opens the sheet at the filters", async ({ page }) => {
  await open(page);
  const sheet = page.getByRole("region", { name: "Sheet" });
  await sheet.getByRole("button", { name: "Close the sheet" }).tap();
  await expect(details(page)).not.toBeInViewport();
  await page.getByRole("button", { name: "Filters" }).tap();
  await expect(details(page).getByRole("group", { name: "Filters" }).getByRole("checkbox", { name: "Themes" })).toBeInViewport();
  // The sheet stays where it opens, at the bottom of the screen.
  const box = (await sheet.boundingBox())!;
  expect(box.y + box.height).toBeCloseTo(844, 0);
});
