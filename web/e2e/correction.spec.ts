import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusIs } from "./scene";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const ANAH = "person:anah_247";

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/?focus=" + ANAH);
  await focusIs(page, ANAH);
});

// Opens the warning, checks it, and reads the form's fields from its link; the test never follows it.
async function form(page: Page, opener: Locator) {
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Suggest a correction" });
  await expect(dialog).toContainText("at least one Evidence Verse");
  await expect(dialog).toContainText("CC BY-SA 4.0");
  await expect(dialog).toContainText("without a GitHub account");
  const href = await dialog.getByRole("link", { name: "Open the form on GitHub" }).getAttribute("href");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  const url = new URL(href!);
  expect(url.origin + url.pathname).toBe("https://github.com/antunderwood/wend-through-the-word/issues/new");
  const fields = Object.fromEntries(url.searchParams);
  // The page address in the form is the shareable address of what the reader sees.
  expect(fields.page_url).toBe(page.url());
  expect(fields.data_version).toBe((await page.getByRole("contentinfo").textContent())!.match(/Data version (\S+)/)![1]);
  return fields;
}

test("the button fills the form for the Selected Node", async ({ page }) => {
  expect(await form(page, panel(page).getByRole("button", { name: "Suggest a correction", exact: true }))).toMatchObject({
    template: "correction-request.yml",
    kind: "An entity fact (for example, gender, name, aliases, place, or year)",
    node_ids: ANAH,
    current_value: "Person: Anah, son of Zibeon (Gen 36:2)",
  });
});

test("a fact and a linked Verse have their own links", async ({ page }) => {
  expect(await form(page, panel(page).getByRole("button", { name: "Suggest a correction to Gender" }))).toMatchObject({
    node_ids: ANAH,
    current_value: "Gender: Male",
  });
  const verses = panel(page).getByRole("list", { name: /^Verse/ });
  expect(await form(page, verses.getByRole("button", { name: "Suggest a correction to the link to Gen 36:14" }))).toMatchObject({
    kind: "A verse link (for example, a verse names someone but has no link)",
    node_ids: `${ANAH}, 01036014`,
    current_value: "Anah: named in this verse (Gen 36:14)",
  });
});

test("a Relationship names both nodes", async ({ page }) => {
  // Fixture: the curated link between Anah and Beeri (possibly the same person).
  await panel(page).getByRole("button", { name: "5 more" }).click();
  await panel(page).getByRole("button", { name: /^Beeri/ }).click();
  await expect(page).toHaveURL(/sel=person:beeri_432/);
  expect(await form(page, panel(page).getByRole("button", { name: "Suggest a correction to the Relationship" }))).toMatchObject({
    kind: "A relationship (for example, a wrong or missing family link)",
    node_ids: `${ANAH}, person:beeri_432`,
    current_value: "Beeri: possibly the same person as Anah",
  });
});
