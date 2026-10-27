import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "./scene";

// The names in bold in the shared Verses (#111, decision 207): the Selected Node's and the Focus's,
// when each is a Person or a Place, drawn as text and strong elements.
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const shared = (page: Page) => panel(page).getByRole("list", { name: /^Together in/ });
// A shared Verse's text, by its reference.
const verseText = (page: Page, ref: string) => shared(page).getByRole("listitem").filter({ hasText: ref }).locator(".verse-text");
const bold = (text: Locator) => text.locator("strong").allTextContents();
const textOf = (text: Locator) => text.evaluate((p) => p.textContent);

test.use({ reducedMotion: "reduce" });

async function open(page: Page, focus: string, sel: string, more = "") {
  await page.goto(`/?focus=${focus}&sel=${sel}${more}`);
  await focusIs(page, focus);
}

test("with Abraham selected and Sarah the Focus, a shared Verse shows both names bold in the Person colour, its text unchanged", async ({ page }) => {
  await open(page, "person:sarah_2473", "person:abraham_58");
  const text = verseText(page, "Gen 25:10");
  await expect(text.locator("strong")).toHaveCount(3);
  expect(await bold(text)).toEqual(["Abraham", "Abraham", "Sarah"]);
  expect(await textOf(text)).toBe("This was the field that Abraham had bought from the Hittites. Abraham was buried there with his wife Sarah.");
  // Bold, in the graph's Person colour (a Place's would be its green), the Verse's own text not.
  const look = await text.locator("strong").first().evaluate((s) => {
    const own = getComputedStyle(s),
      verse = getComputedStyle(s.parentElement!);
    return { colour: own.color, plain: verse.color, heavier: +own.fontWeight > +verse.fontWeight };
  });
  expect(look.colour).toBe("rgb(111, 168, 220)"); // #6fa8dc
  expect(look.colour).not.toBe(look.plain);
  expect(look.heavier).toBe(true);
});

test("a Verse that does not write the name (a pronoun) shows plain", async ({ page }) => {
  // Gen 25:8 says "he breathed his last" of Abraham; Death is a Theme.
  await open(page, "person:abraham_58", "theme:death");
  const text = verseText(page, "Gen 25:8");
  await expect(text).toContainText("he breathed his last");
  await expect(text.locator("strong")).toHaveCount(0);
});

test("a shared Verse for a Theme bolds no word for the Theme, and still bolds the Person at the other end", async ({ page }) => {
  await open(page, "person:abraham_58", "theme:genealogy");
  await expect(shared(page).getByRole("listitem")).toHaveCount(8);
  // "This is the record of the genealogy of Jesus Christ, ... the son of Abraham:"
  expect(await bold(verseText(page, "Matt 1:1"))).toEqual(["Abraham"]);
  const all = await shared(page).locator("strong").allTextContents();
  expect(new Set(all)).toEqual(new Set(["Abram", "Abraham", "Abraham’s"]));
});

test("a list shared with a pin bolds the names of both its ends", async ({ page }) => {
  await open(page, "person:sarah_2473", "person:abraham_58", "&pins=place:ur_1189");
  const withUr = panel(page).getByRole("list", { name: /^Together with Ur of the Chaldees in 1 verse/ });
  // "And Terah took his son Abram, ... the wife of Abram, and they set out from Ur of the Chaldeans"
  const text = withUr.getByRole("listitem").filter({ hasText: "Gen 11:31" }).locator(".verse-text");
  await expect(text.locator("strong")).toHaveText(["Abram", "Abram", "Ur"]);
});

test("a list shared with an Event bolds no word for the Event, and still bolds the Person at the other end", async ({ page }) => {
  // The Event "Abraham enters Canaan": "Canaan" in Gen 11:31 stays plain, Abraham's "Abram" bolds.
  await open(page, "event:71", "person:abraham_58");
  const text = verseText(page, "Gen 11:31");
  await expect(text).toContainText("for the land of Canaan");
  await expect(text.locator("strong")).toHaveText(["Abram", "Abram"]);
});

test("markup in a Verse's text is shown as text, not drawn", async ({ page }) => {
  // A Verse whose text holds markup, served in place of the fixture's.
  const marked = "Abraham <b>was</b> buried <img src=x> with Sarah & no one else.";
  await page.route("**/chapter/Gen/25.json", async (route) => {
    const chapter = await (await route.fetch()).json();
    chapter.verses.find((v: { key: string }) => v.key === "01025010").text_bsb = marked;
    await route.fulfill({ json: chapter });
  });
  await open(page, "person:sarah_2473", "person:abraham_58");
  const text = verseText(page, "Gen 25:10");
  // Waits for the list, which is drawn after the Focus.
  await expect(text.locator("strong")).toHaveText(["Abraham", "Sarah"]);
  expect(await textOf(text)).toBe(marked);
  await expect(text.locator("b, img")).toHaveCount(0);
});
