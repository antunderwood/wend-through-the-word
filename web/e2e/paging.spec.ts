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

// The filter box on a long list (#101): the whole list is searched, not the rows shown.
const filterBox = (page: Page, type: string) => panel(page).getByRole("searchbox", { name: `Filter ${type}` });

test("a long list has a filter box that finds a row past the first 100, and a short list has none", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  await expect(filterBox(page, "Person")).toBeVisible();
  await filterBox(page, "Person").fill("Ziza");
  const matches = panel(page).getByRole("list", { name: "Person (1 of 127)" }).getByRole("listitem");
  await expect(matches).toHaveCount(1);
  await expect(matches.first()).toContainText("Ziza");
  // Judah's one Verse is a short list.
  await expect(panel(page).getByRole("searchbox")).toHaveCount(1);
});

test("a query ignores case and accents, and the keyboard reaches the box from the list", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  await filterBox(page, "Person").fill("  ZÉRUBBABEL ");
  await expect(panel(page).getByRole("list", { name: "Person (1 of 127)" })).toContainText("Zerubbabel");
  await filterBox(page, "Person").fill("");
  await people(page).getByRole("listitem").first().getByRole("button").first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(filterBox(page, "Person")).toBeFocused();
});

test("a query matching more than 100 rows pages by 100", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  await filterBox(page, "Person").fill("a");
  const matches = panel(page).getByRole("list", { name: /^Person \(\d+ of 127\)$/ }).getByRole("listitem");
  await expect(matches).toHaveCount(100);
  await panel(page).getByRole("button", { name: /^Show \d+ more \(100 of \d+\)$/ }).click();
  await expect(panel(page).getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);
  expect(await matches.count()).toBeGreaterThan(100);
});

test("a query finds a row behind \"N more\" without opening the list, and clearing restores the closed list", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}`);
  await focusIs(page, JUDAH);
  await filterBox(page, "Person").fill("Ziza");
  await expect(panel(page).getByRole("list", { name: "Person (1 of 127)" })).toContainText("Ziza");
  await expect(panel(page).getByRole("button", { name: "121 more" })).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Clear filter Person" }).click();
  await expect(people(page).getByRole("listitem")).toHaveCount(6);
  await expect(panel(page).getByRole("button", { name: "121 more" })).toBeVisible();
});

test("no match says so and keeps the box, and the clear button and Escape restore the list", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  await filterBox(page, "Person").fill("qqqq");
  await expect(panel(page).getByText("No match")).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Person (0 of 127)" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Clear filter Person" }).click();
  await expect(panel(page).getByText("No match")).toHaveCount(0);
  await expect(people(page).getByRole("listitem")).toHaveCount(100);
  await filterBox(page, "Person").fill("qqqq");
  await filterBox(page, "Person").press("Escape");
  await expect(filterBox(page, "Person")).toHaveValue("");
  await expect(people(page).getByRole("listitem")).toHaveCount(100);
});

test("a double click on a filtered row makes the Focus, and the new Focus has no query", async ({ page }) => {
  await page.goto(`/?focus=${JUDAH}&sel=overflow:person`);
  await focusIs(page, JUDAH);
  await filterBox(page, "Person").fill("Ziza");
  await panel(page).getByRole("list", { name: "Person (1 of 127)" }).getByRole("button", { name: /^Ziza/ }).dblclick();
  await expect(panel(page).getByRole("heading", { level: 2 })).toContainText("Ziza");
  await expect(page).toHaveURL(/focus=person:ziza/);
  await expect(page.getByRole("button", { name: "Make Focus" })).toBeDisabled();
  for (const box of await panel(page).getByRole("searchbox").all()) await expect(box).toHaveValue("");
});

test("two lists filter independently, a click keeps the query, and the address does not carry it", async ({ page }) => {
  await page.goto("/?focus=person:abraham_58");
  await panel(page).getByRole("heading", { name: "Theme (37)" }).waitFor();
  await filterBox(page, "Person").fill("Isaac");
  await expect(panel(page).getByRole("list", { name: /^Person \(\d+ of 24\)$/ })).toContainText("Isaac");
  // The other list, and a short list, are untouched.
  await expect(panel(page).getByRole("heading", { name: "Theme (37)" })).toBeVisible();
  await expect(filterBox(page, "Theme")).toHaveValue("");
  await expect(panel(page).getByRole("searchbox", { name: "Filter Location" })).toHaveCount(0);
  await filterBox(page, "Theme").fill("zzzz");
  await expect(panel(page).getByRole("heading", { name: "Theme (0 of 37)" })).toBeVisible();
  await expect(filterBox(page, "Person")).toHaveValue("Isaac");
  expect(new URL(page.url()).search).toBe("?focus=person:abraham_58");
  // A click on a filtered row selects it and keeps the lists as they are.
  await panel(page).getByRole("list", { name: /^Person \(/ }).getByRole("button", { name: /^Isaac/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toContainText("Isaac");
  await expect(filterBox(page, "Person")).toHaveValue("Isaac");
});
