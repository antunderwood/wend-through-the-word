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
  await expect(relationship(page)).toHaveText("Relationship: possibly the same person as Anah (Gen 26:34) Suggest a correction");
  await expect(notes(page)).toHaveText([
    'Note on the Relationship: Esau\'s wife is "Judith daughter of Beeri" in Gen.26.34 and "Oholibamah daughter of Anah" in Gen.36.2. Evidence: Gen 26:34, Gen 36:2, Gen 36:24.',
  ]);
  await relationship(page).getByRole("button", { name: "Gen 26:34" }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 26:34");
});

test("a corrected link says so once, and a moved link shows its note and Evidence Verses", async ({ page }) => {
  // Fixture: links.csv moves Gen 36:25 and Dishon and Aholibamah to the son of Zibeon (#44).
  await focusOn(page, "Anah", /^Anah, father of Dishon \(Gen 36:24\)/, "person:anah_249");
  const corrected = panel(page).getByRole("list", { name: "Corrections" }).getByRole("listitem");
  await expect(corrected).toHaveCount(1);
  await expect(corrected).toContainText("Corrected after review: link (Gen 36:24, Gen 36:25). The owner's reading");
  const note = /^Note on the Relationship: The owner's reading, with most commentators: .* Evidence: Gen 36:24, Gen 36:25\.$/;
  await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Dishon/ }).click();
  await expect(relationship(page)).toHaveText("Relationship: son of Anah (Gen 36:24) Suggest a correction");
  await expect(notes(page)).toHaveText([note]);
  await panel(page).getByRole("list", { name: /^Verse/ }).getByRole("button", { name: /^Gen 36:25/ }).click();
  await expect(notes(page)).toHaveText([note]);
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
  await expect(panel(page).getByText("Theme", { exact: true })).toHaveAttribute("title", "Theme, from Nave's Topical Bible, CC BY 4.0");
  await expect(relationship(page)).toHaveAttribute("title", /Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0$/);
  await settled();
  expect(await y(genealogy)).toBe(neighbour);

  const verse = panel(page).getByRole("list", { name: "Together in 6 verses" }).getByRole("button", { name: /^Gen 11:27/ });
  const shared = await y(verse);
  await verse.click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:27");
  // The one Relationship line keeps the full words the lists drop (decision 142), at its fixed height.
  const line = panel(page).locator(".relationship");
  await expect(line).toHaveAttribute("title", /^Relationship: named in this verse\./);
  await expect(line).toContainText("Relationship: named in this verse");
  await settled();
  expect(await y(verse)).toBe(shared);

  // A Verse's text above the lists (decision 138) leaves them where they were.
  await focusOn(page, "Gen 16:1", /^Gen 16:1/, "01016001");
  await expect(panel(page)).toContainText("Now Abram’s wife Sarai had borne him no children");
  const cross = panel(page).getByRole("list", { name: /^Verse/ }).getByRole("button", { name: /^Gen 11:30/ });
  const crossY = await y(cross);
  await cross.click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gen 11:30");
  await expect(panel(page)).toContainText("But Sarai was barren; she had no children.");
  await settled();
  expect(await y(cross)).toBe(crossY);
});

test("the Dictionary Entry is named as Easton's, folded after its first paragraph, and opens with Read more", async ({ page }) => {
  const entry = panel(page).getByRole("region", { name: "Easton's Bible Dictionary (1897)" });
  await expect(entry.getByRole("paragraph").first()).toHaveText(/^Father of a multitude, son of Terah/);
  await expect(entry).not.toContainText("Abram now, with a large household");
  await expect(entry.getByRole("heading")).toHaveAttribute("title", "Public domain (1897)");
  const more = entry.getByRole("button", { name: "Read more" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(entry).toContainText("Abram now, with a large household");
  await entry.getByRole("button", { name: "Read less" }).click();
  await expect(entry).not.toContainText("Abram now, with a large household");
});

test("an Event shows its year as approx., Jones chronology; a Place its coordinates and their source", async ({ page }) => {
  await focusOn(page, "Birth of Arphaxad", /^Birth of Arphaxad/, "event:45");
  await expect(facts(page).getByRole("listitem")).toHaveText(["Event Year 2346 BC (approx., Jones chronology) Suggest a correction"]);
  await focusOn(page, "Gerar", /^Gerar/, "place:gerar_459");
  await expect(facts(page).getByRole("listitem")).toHaveText(["Other names Valley of Gerar Suggest a correction", "Coordinates 31.3821° N, 34.6065° E Suggest a correction"]);
  await expect(facts(page).getByRole("listitem").nth(1)).toHaveAttribute("title", "OpenBible.info Bible Geocoding Data, CC BY 4.0");
});

test("an Entity's linked Verses are in Bible order, each with its source, and toggle with N more", async ({ page }) => {
  // Fixture: Abraham is linked to 26 Verses, 6 in Ring 1.
  const verses = panel(page).getByRole("list", { name: "Verse (26)" });
  await expect(verses.getByRole("listitem")).toHaveCount(6);
  await panel(page).getByRole("button", { name: "20 more" }).click();
  await expect(verses.getByRole("listitem")).toHaveCount(26);
  const keys = (await verses.getByRole("button", { name: /^Gen/ }).allTextContents()).map((t) => t.match(/Gen (\d+):(\d+)/)!.slice(1).map(Number));
  expect(keys).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  await expect(verses.getByRole("listitem").first()).toHaveAttribute("title", "Theographic, CC BY-SA 4.0");
  await panel(page).getByRole("button", { name: "Show first 6" }).click();
  await expect(verses.getByRole("listitem")).toHaveCount(6);
  // A Theme's Verses are Filed Under it, from Nave's.
  await panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("button", { name: /^Genealogy/ }).dblclick();
  await focusIs(page, "theme:genealogy");
  await expect(panel(page).getByRole("list", { name: /^Verse/ }).getByRole("listitem").first()).toHaveAttribute("title", "Nave's Topical Bible, CC BY 4.0");
});

// Decision 139: sources and licences are hover titles only; the credits page lists them all.
test("each fact and link keeps its source in a hover title, not in the text", async ({ page }) => {
  await expect(panel(page).getByText("Person", { exact: true })).toHaveAttribute("title", "Person, from Theographic, CC BY-SA 4.0");
  await expect(facts(page).getByRole("listitem")).toHaveText(["Also called Abram Suggest a correction", "Gender Male Suggest a correction"]);
  await expect(facts(page).getByRole("listitem").first()).toHaveAttribute("title", "Theographic, CC BY-SA 4.0");
  await expect(panel(page)).not.toContainText("CC BY");
  // A derived Neighbour: both sources, each with its own licence.
  await panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("button", { name: /^Genealogy/ }).click();
  // The Relationship line keeps the full words (decision 142); the lists show only the count.
  await expect(relationship(page)).toHaveText("Relationship: together in 6 verses Suggest a correction");
  await expect(relationship(page)).toHaveAttribute("title", "Relationship: together in 6 verses. Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0");
  // Every Neighbour list item too, as the Relationship line says it.
  await expect(panel(page).getByRole("list", { name: "Theme (36)" }).getByRole("listitem").filter({ hasText: "Genealogy" })).toHaveAttribute(
    "title",
    "Nave's Topical Bible, CC BY 4.0; Theographic, CC BY-SA 4.0",
  );
});

test("a Verse's Neighbours, Cross-references included, each keep where they came from", async ({ page }) => {
  await page.goto("/?focus=01011029");
  await focusIs(page, "01011029");
  const sarah = panel(page).getByRole("list", { name: /^Person/ }).getByRole("listitem").filter({ hasText: "Sarah" });
  await expect(sarah).toHaveAttribute("title", "Theographic, CC BY-SA 4.0");
  // Fixture: Gen 11:29's one Cross-reference, to Ezek 16:3.
  await expect(panel(page).getByRole("list", { name: /^Verse/ }).getByRole("listitem")).toHaveAttribute("title", "OpenBible.info, CC BY 4.0");
  // Words that never vary for the pair are dropped: a named Person shows none, a Cross-reference
  // only its Votes (decision 141).
  await expect(sarah.locator(".item .muted")).toHaveCount(0);
  await expect(panel(page).getByRole("list", { name: /^Verse/ }).locator(".item .muted")).toHaveText("4 votes");
});

test("a list row's correction link shows on hover, on keyboard focus, or for the Selected Node, and never moves the list", async ({ page }) => {
  const persons = panel(page).getByRole("list", { name: "Person (21)" });
  const isaac = persons.getByRole("listitem").filter({ hasText: /^Isaac/ });
  const next = persons.getByRole("listitem").nth(1);
  const link = isaac.getByRole("button", { name: "Suggest a correction to the link to Isaac" });
  // Faded out, not removed, so the keyboard and screen readers still find it (decision 143).
  const shown = () => link.evaluate((e) => getComputedStyle(e).opacity);
  await expect.poll(shown).toBe("0");
  const line = (await isaac.boundingBox())!.height;
  expect(line).toBeLessThan(30);
  const below = (await next.boundingBox())!.y;
  await isaac.hover();
  await expect.poll(shown).toBe("1");
  // Laid over the row's right edge: nothing below moves.
  expect((await next.boundingBox())!.y).toBe(below);
  await page.mouse.move(0, 0);
  await expect.poll(shown).toBe("0");
  // The keyboard reaches it from the row's name.
  await isaac.getByRole("button", { name: /^Isaac/ }).focus();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect.poll(shown).toBe("1");
  // Selected, the row keeps it.
  await isaac.getByRole("button", { name: /^Isaac/ }).click();
  await page.mouse.move(0, 0);
  await page.getByRole("searchbox", { name: "Search" }).focus();
  await expect.poll(shown).toBe("1");
});
