import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

// Fixture: the tribe of Judah has 127 People, 6 in Ring 1 and 121 behind the Overflow Node, whose
// list holds all 127.
const JUDAH = "group:tribe_of_judah";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const people = (page: Page) => panel(page).getByRole("list", { name: "Person (127)" });

test.use({ reducedMotion: "reduce" });

test("a long Neighbour list shows 100 rows, then the rest, and a double click past 100 still makes the Focus", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}`);
  await focusIs(page, JUDAH);
  await panel(page).getByRole("button", { name: "121 more" }).click();
  await expect(people(page).getByRole("listitem")).toHaveCount(100);
  await panel(page).getByRole("button", { name: "Show 27 more (100 of 127)" }).click();
  await expect(people(page).getByRole("listitem")).toHaveCount(127);
  await expect(panel(page).getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);

  // The last row: its first click selects and keeps the list, its second makes the Focus.
  const last = people(page).getByRole("listitem").last().getByRole("button").first();
  const name = await last.evaluate((b) => b.firstChild!.textContent!.trim()); // the name, not the words after it
  await last.dblclick();
  await expect(panel(page).getByRole("heading", { level: 2 })).toContainText(name);
  await expect(page.getByRole("button", { name: "Make Focus" })).toBeDisabled();
});

test("an Overflow Node's list pages by 100, and the keyboard reaches Show more", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  const rows = people(page).getByRole("listitem");
  await expect(rows).toHaveCount(100);
  // Tab from the last row's correction flag lands on the button below the list.
  await rows.last().getByRole("button", { name: /^Suggest a correction/ }).focus();
  await page.keyboard.press("Tab");
  await expect(panel(page).getByRole("button", { name: "Show 27 more (100 of 127)" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(127);
});
