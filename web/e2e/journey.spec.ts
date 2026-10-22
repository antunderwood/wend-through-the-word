import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { doubleClickLabel, focusIs, nodes, themesOnScreen } from "./scene";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  ISAAC = "person:isaac_616";
const at = async (page: Page, id: string) => (await nodes(page)).find((n) => n.id === id)!;
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const heading = (page: Page) => panel(page).getByRole("heading", { level: 2 });
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });

const VIEW_NAME = { A: "Tilted plane", B: "Stacked discs", C: "Free orbit" };
// Each journey switches to the next view.
const NEXT = { A: "B", B: "C", C: "A" } as const;

test.use({ reducedMotion: "reduce" });

for (const view of ["A", "B", "C"] as const) {
  test(`the student journey, studying Abraham, in view ${view}`, async ({ page }) => {
    // Only the first load: a reload must find the view the journey chose.
    await page.addInitScript((v) => localStorage.getItem("wend.view") || localStorage.setItem("wend.view", v), view);
    await page.goto("/");
    await focusIs(page, ABRAHAM);
    await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName(VIEW_NAME[view]);

    // Search "Abraham": he is the Focus and the list closes. The page opens on him, so he already was.
    const box = page.getByRole("searchbox", { name: "Search" });
    const results = page.getByRole("list", { name: "Search results" });
    await box.fill("Abraham");
    await results.getByRole("button").first().click();
    await expect(results).toBeHidden();
    await expect(box).toHaveValue("");
    await expect(page.getByRole("status")).toHaveText("Abraham is already the Focus.");
    await focusIs(page, ABRAHAM);

    // A scene click on a Ring 1 Person selects her; the scene does not change.
    const before = await nodes(page);
    const sarah = before.find((n) => n.id === SARAH)!;
    expect(sarah.role).toBe("ring1");
    await page.mouse.click(sarah.x, sarah.y);
    await expect(heading(page)).toHaveText("Sarah");
    expect(await nodes(page)).toEqual(before);

    // Back to Abraham with a scene click on the Focus; his Themes open with "N more" and close.
    const abraham = before.find((n) => n.id === ABRAHAM)!;
    await page.mouse.click(abraham.x, abraham.y);
    await expect(heading(page)).toHaveText("Abraham");
    // Fixture: Abraham has 37 Themes, 6 in Ring 1 and 31 behind the Overflow Node.
    const themes = panel(page).getByRole("list", { name: "Theme (37)" });
    await expect(themes.getByRole("listitem")).toHaveCount(6);
    await panel(page).getByRole("button", { name: "31 more" }).click();
    await expect(themes.getByRole("listitem")).toHaveCount(37);
    await panel(page).getByRole("button", { name: "Show top 6" }).click();
    await expect(themes.getByRole("listitem")).toHaveCount(6);

    // A Theme and the Verses it shares with Abraham. Genealogy stands in for Faith, which shares
    // no Verse with Abraham in the fixture.
    await themes.getByRole("button", { name: /^Genealogy/ }).click();
    await expect(heading(page)).toHaveText("Genealogy");
    const verses = panel(page).getByRole("list", { name: "Together in 8 verses" }).getByRole("listitem");
    await expect(verses).toHaveCount(8);
    await expect(verses.first()).toContainText("Gen 11:26");
    await expect(verses.first()).toContainText("When Terah was 70 years old, he became the father of Abram, Nahor, and Haran.");
    expect(await nodes(page)).toEqual(before);

    // A scene double click makes Isaac the Focus; the Your Path bar shows him then Abraham.
    const isaac = await at(page, ISAAC);
    await page.mouse.dblclick(isaac.x, isaac.y);
    await focusIs(page, ISAAC);
    const bar = page.getByRole("navigation", { name: "Your Path" });
    const items = bar.getByRole("listitem");
    await expect(items).toHaveText(["Isaac", "Abraham"]);

    // Pin Abraham from the Your Path bar.
    await bar.getByRole("button", { name: "Abraham" }).click();
    await expect(heading(page)).toHaveText("Abraham");
    await panel(page).getByRole("button", { name: "Pin", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Pinned Abraham.");
    expect((await at(page, ABRAHAM)).role).toBe("pinned");

    // Prev and Next read along Your Path and leave the Focus where it is.
    await panel(page).getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading(page)).toHaveText("Isaac");
    await panel(page).getByRole("button", { name: "Prev", exact: true }).click();
    await expect(heading(page)).toHaveText("Abraham");
    await focusIs(page, ISAAC);

    // Clear keeps a pinned Selected Node selected; Undo clear gives Your Path back.
    await bar.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(items).toHaveText(["Isaac"]);
    await expect(heading(page)).toHaveText("Abraham");
    await bar.getByRole("button", { name: "Undo clear" }).click();
    await expect(items).toHaveText(["Isaac", "Abraham"]);

    // A view switch keeps the Focus, the pin, the selection, Your Path, and every node.
    const ids = (await nodes(page)).map((n) => n.id).sort();
    await picker(page).getByRole("radio", { name: VIEW_NAME[NEXT[view]] }).click();
    await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName(VIEW_NAME[NEXT[view]]);
    await focusIs(page, ISAAC);
    expect((await at(page, ABRAHAM)).role).toBe("pinned");
    expect((await nodes(page)).map((n) => n.id).sort()).toEqual(ids);
    await expect(heading(page)).toHaveText("Abraham");
    await expect(items).toHaveText(["Isaac", "Abraham"]);

    // A reload opens the address, so the Focus, the pin, and the view are kept.
    await page.reload();
    await focusIs(page, ISAAC);
    expect((await at(page, ABRAHAM)).role).toBe("pinned");
    await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName(VIEW_NAME[NEXT[view]]);
  });
}

// M4: a student opens a shared link, reads Gen 11 on to Gen 36, checks what the data says about
// Anah, reports it, filters, writes a note, and finds the credits.
const ANAH = "person:anah_247";
const reader = (page: Page) => page.getByRole("region", { name: "Reader" });
const verse = (page: Page, ref: string) => reader(page).getByRole("button", { name: ref, exact: true });
const persons = (page: Page) => panel(page).getByRole("list", { name: /^Person/ });
const filters = (page: Page) => page.getByRole("dialog", { name: "Filters" });
const search = (page: Page) => new URL(page.url()).search;

for (const view of ["A", "B", "C"] as const) {
  test(`the M4 journey, from a shared link to the credits, in view ${view}`, async ({ page }) => {
    // A shared link: Abraham the Focus, Gen 11:31 selected, in this view.
    await page.goto(`/?sel=01011031&view=${view}`);
    await focusIs(page, ABRAHAM);
    await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName(VIEW_NAME[view]);
    await expect(heading(page)).toHaveText("Gen 11:31");

    // Read the chapter, read on to Gen 36 (the fixture builds Gen 11, 16, 25, 26, 36), and make
    // Gen 36:2 the Focus from the reader panel.
    await panel(page).getByRole("button", { name: "Read", exact: true }).click();
    await expect(reader(page).getByRole("heading", { name: "Genesis 11" })).toBeVisible();
    await expect(verse(page, "Gen 11:31")).toHaveAttribute("aria-current", "true");
    for (const title of ["Genesis 16", "Genesis 25", "Genesis 26", "Genesis 36"]) {
      await reader(page).getByRole("button", { name: "Next chapter" }).click();
      await expect(reader(page).getByRole("heading", { name: title })).toBeVisible();
    }
    await verse(page, "Gen 36:2").dblclick();
    await focusIs(page, "01036002");
    await expect(heading(page)).toHaveText("Gen 36:2");

    // Oholibamah's Dictionary Entry, then Anah's correction note.
    await persons(page).getByRole("button", { name: /^Aholibamah/ }).click();
    await expect(panel(page).getByRole("region", { name: "Easton's Bible Dictionary (1897)" })).toContainText("the daughter of Beeri the Hittite");
    await persons(page).getByRole("button", { name: /^Anah/ }).click();
    await expect(panel(page).getByRole("list", { name: "Corrections" })).toContainText("Corrected after review: gender (Gen 36:24)");

    // The correction link for her gender fills the form; the test never follows it.
    await panel(page).getByRole("list", { name: "Facts" }).getByRole("listitem").filter({ hasText: "Gender" }).hover();
    await panel(page).getByRole("button", { name: "Suggest a correction to Gender" }).click();
    const dialog = page.getByRole("dialog", { name: "Suggest a correction" });
    const fields = new URL((await dialog.getByRole("link", { name: "Open the form on GitHub" }).getAttribute("href"))!).searchParams;
    expect(fields.get("node_ids")).toBe(ANAH);
    expect(fields.get("current_value")).toBe("Gender: Male");
    expect(fields.get("page_url")).toBe(page.url());
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    // Hide Themes; opening the address again keeps them hidden, and turning them on brings them back.
    await page.getByRole("button", { name: "Filters" }).click();
    await filters(page).getByRole("checkbox", { name: "Themes" }).uncheck();
    await expect.poll(() => themesOnScreen(page)).toBe(0);
    await expect.poll(() => search(page)).toContain("hide=theme");
    await page.reload();
    await focusIs(page, "01036002");
    await expect(heading(page)).toHaveText(/^Anah/);
    expect(await themesOnScreen(page)).toBe(0);
    await page.getByRole("button", { name: "Filters" }).click();
    await filters(page).getByRole("checkbox", { name: "Themes" }).check();
    await expect.poll(() => themesOnScreen(page)).toBeGreaterThan(0);
    expect(search(page)).not.toContain("hide=");
    await page.keyboard.press("Escape");

    // A double click on Anah's name in the scene makes her the Focus; a note on her is kept across a
    // reload and in the download.
    await doubleClickLabel(page, "Anah, son of Zibeon (Gen 36:2)", ANAH);
    await panel(page).getByRole("textbox", { name: /^Note on Anah/ }).fill("A man in Gen 36:24.");
    await page.reload();
    await focusIs(page, ANAH);
    await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName(VIEW_NAME[view]);
    await expect(panel(page).getByRole("textbox", { name: /^Note on Anah/ })).toHaveValue("A man in Gen 36:24.");
    const [file] = await Promise.all([page.waitForEvent("download"), panel(page).getByRole("button", { name: "Download notes" }).click()]);
    const text = await readFile((await file.path())!, "utf8");
    expect(text.match(/^## .*/gm)).toEqual(["## 1. Abraham", "## 2. Gen 36:2", expect.stringMatching(/^## 3\. Anah/)]);
    expect(text).toContain("A man in Gen 36:24.");

    // The footer leads to the credits page.
    await page.getByRole("link", { name: "About and credits" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About and credits");
  });
}
