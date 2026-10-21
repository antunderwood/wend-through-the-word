import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const facts = (page: Page) => panel(page).getByRole("list", { name: "Facts" });
const relationship = (page: Page) => panel(page).getByRole("paragraph").filter({ hasText: /^Relationship:/ });
const notes = (page: Page) => panel(page).getByText(/^Note on the Relationship:/);

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
});

async function focusOn(page: Page, query: string, name: RegExp, id: string) {
  await page.getByRole("searchbox", { name: "Search" }).fill(query);
  await page.getByRole("list", { name: "Search results" }).getByRole("button", { name }).first().click();
  await focusIs(page, id);
}

test("a corrected item says so with its Evidence Verse, and a curated link shows its note and Evidence Verses", async ({ page }) => {
  // Fixture: Anah of Gen 36:2, whose gender is corrected (decision 28), and her link to Beeri.
  await focusOn(page, "Anah", /^Anah, son of Zibeon \(Gen 36:2\)/, "person:anah_247");
  await expect(facts(page).getByRole("listitem").filter({ hasText: "Gender" })).toContainText("Male");
  const corrected = panel(page).getByRole("list", { name: "Corrections" }).getByRole("listitem");
  await expect(corrected).toHaveCount(1);
  await expect(corrected).toContainText("Corrected after review: gender (Gen 36:24)");
  await expect(corrected).toContainText('BSB Gen.36.24 reads "Anah son of Zibeon".');

  await panel(page).getByRole("button", { name: "5 more" }).click();
  await panel(page).getByRole("list", { name: "Person (11)" }).getByRole("button", { name: /^Beeri/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Beeri");
  // The first Evidence Verse is in the Relationship line (decision 135); the note has them all.
  await expect(relationship(page)).toHaveText("Relationship: possibly the same person as Anah (Gen 26:34) Curated, CC BY-SA 4.0 Suggest a correction");
  await expect(notes(page)).toHaveText([
    'Note on the Relationship: Esau\'s wife is "Judith daughter of Beeri" in Gen.26.34 and "Oholibamah daughter of Anah" in Gen.36.2. Evidence: Gen 26:34, Gen 36:2, Gen 36:24.',
  ]);
  await relationship(page).getByRole("button", { name: "Gen 26:34" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 26:34");
});

test("a curated item with a request links to it", async ({ page }) => {
  // Fixture: Hagar's curated links to Abraham carry request #900 (synthetic).
  await panel(page).getByRole("list", { name: "Person (21)" }).getByRole("button", { name: /^Hagar/ }).click();
  await expect(notes(page)).toHaveCount(2);
  await expect(notes(page).first().getByRole("link", { name: "Request #900" })).toHaveAttribute("href", "https://github.com/antunderwood/wend-through-the-word/issues/900");
});

test("a shared Verse can be double clicked while the Selected Node shows its details", async ({ page }) => {
  // Sarah has a curated note and facts, which a click on a shared Verse removes from above it.
  await panel(page).getByRole("list", { name: "Person (21)" }).getByRole("button", { name: /^Sarah/ }).click();
  await expect(notes(page)).toHaveCount(1);
  await panel(page).getByRole("list", { name: /^Together in/ }).getByRole("button").first().dblclick();
  await focusIs(page, "01011029");
});

// The second click of a double click lands where the first did only if nothing above the item moves.
test("a list item stays put between the two clicks of a double click", async ({ page }) => {
  const settled = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // Genealogy: a Co-mention with two sources, and a type line whose source loads after the click.
  const genealogy = panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("button", { name: /^Genealogy/ });
  // A click scrolls its target into view first; measure after that.
  const y = async (item: typeof genealogy) => (await item.scrollIntoViewIfNeeded(), (await item.boundingBox())!.y);
  const neighbour = await y(genealogy);
  await genealogy.click();
  await expect(panel(page).getByText("Theme, from Nave's Topical Bible, CC BY 4.0")).toBeVisible();
  await expect(relationship(page)).toContainText("Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0");
  await settled();
  expect(await y(genealogy)).toBe(neighbour);

  const verse = panel(page).getByRole("list", { name: "Together in 6 verses" }).getByRole("button", { name: /^Gen 11:27/ });
  const shared = await y(verse);
  await verse.click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  await expect(relationship(page)).toContainText("Suggest a correction");
  await settled();
  expect(await y(verse)).toBe(shared);
});

test("the Dictionary Entry is named as Easton's, folded after its first paragraph, and opens with Read more", async ({ page }) => {
  const entry = panel(page).getByRole("region", { name: "Easton's Bible Dictionary (1897)" });
  await expect(entry.getByRole("paragraph").first()).toHaveText(/^Father of a multitude, son of Terah/);
  await expect(entry).not.toContainText("Abram now, with a large household");
  await expect(entry).toContainText("Public domain (1897)");
  const more = entry.getByRole("button", { name: "Read more" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(entry).toContainText("Abram now, with a large household");
  await entry.getByRole("button", { name: "Read less" }).click();
  await expect(entry).not.toContainText("Abram now, with a large household");
});

test("an Event shows its year as approx., Jones chronology; a Place its coordinates and their source", async ({ page }) => {
  await focusOn(page, "Birth of Arphaxad", /^Birth of Arphaxad/, "event:45");
  await expect(facts(page).getByRole("listitem")).toHaveText(["Event Year 2346 BC (approx., Jones chronology) Theographic, CC BY-SA 4.0 Suggest a correction"]);
  await focusOn(page, "Gerar", /^Gerar/, "place:gerar_459");
  await expect(facts(page).getByRole("listitem")).toHaveText([
    "Other names Valley of Gerar Theographic, CC BY-SA 4.0 Suggest a correction",
    "Coordinates 31.3821° N, 34.6065° E OpenBible.info Bible Geocoding Data, CC BY 4.0 Suggest a correction",
  ]);
});

test("an Entity's linked Verses are in Bible order, each with its source, and toggle with N more", async ({ page }) => {
  // Fixture: Abraham is linked to 26 Verses, 6 in Ring 1.
  const verses = panel(page).getByRole("list", { name: "Verse (26)" });
  await expect(verses.getByRole("listitem")).toHaveCount(6);
  await panel(page).getByRole("button", { name: "20 more" }).click();
  await expect(verses.getByRole("listitem")).toHaveCount(26);
  const keys = (await verses.getByRole("button", { name: /^Gen/ }).allTextContents()).map((t) => t.match(/Gen (\d+):(\d+)/)!.slice(1).map(Number));
  expect(keys).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  await expect(verses.getByRole("listitem").first()).toContainText("Theographic, CC BY-SA 4.0");
  await panel(page).getByRole("button", { name: "Show first 6" }).click();
  await expect(verses.getByRole("listitem")).toHaveCount(6);
  // A Theme's Verses are Filed Under it, from Nave's.
  await panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("button", { name: /^Genealogy/ }).dblclick();
  await focusIs(page, "theme:genealogy");
  await expect(panel(page).getByRole("list", { name: /^Verse/ }).getByRole("listitem").first()).toContainText("Nave's Topical Bible, CC BY 4.0");
});

test("each fact and link says where it came from", async ({ page }) => {
  await expect(panel(page).getByText("Person, from Theographic, CC BY-SA 4.0")).toBeVisible();
  await expect(facts(page).getByRole("listitem")).toHaveText(["Also called Abram Theographic, CC BY-SA 4.0 Suggest a correction", "Gender Male Theographic, CC BY-SA 4.0 Suggest a correction"]);
  // A derived Neighbour: both sources, each with its own licence.
  await panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("button", { name: /^Genealogy/ }).click();
  await expect(relationship(page)).toHaveText("Relationship: together in 6 verses Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0 Suggest a correction");
  // Every Neighbour list item too, as the Relationship line says it.
  await expect(panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("listitem").filter({ hasText: "Genealogy" })).toHaveText(
    "Genealogy together in 6 verses Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0 Suggest a correction",
  );
});

test("a Verse's Neighbours, Cross-references included, each say where they came from", async ({ page }) => {
  await page.goto("/?focus=01011029");
  await focusIs(page, "01011029");
  const sarah = panel(page).getByRole("list", { name: /^Person/ }).getByRole("listitem").filter({ hasText: "Sarah" });
  await expect(sarah).toHaveText("Sarah named Theographic, CC BY-SA 4.0 Suggest a correction");
  // Fixture: Gen 11:29's one Cross-reference, to Ezek 16:3.
  await expect(panel(page).getByRole("list", { name: /^Verse/ }).getByRole("listitem")).toHaveText(["Ezek 16:3 cross-reference, 4 votes OpenBible.info, CC BY 4.0 Suggest a correction"]);
});
