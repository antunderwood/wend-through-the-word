import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes } from "./scene";

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
    // Fixture: Abraham has 36 Themes, 6 in Ring 1 and 30 behind the Overflow Node.
    const themes = panel(page).getByRole("list", { name: "Theme (36)" });
    await expect(themes.getByRole("listitem")).toHaveCount(6);
    await panel(page).getByRole("button", { name: "30 more" }).click();
    await expect(themes.getByRole("listitem")).toHaveCount(36);
    await panel(page).getByRole("button", { name: "Show top 6" }).click();
    await expect(themes.getByRole("listitem")).toHaveCount(6);

    // A Theme and the Verses it shares with Abraham. Genealogy stands in for Faith, which shares
    // no Verse with Abraham in the fixture.
    await themes.getByRole("button", { name: /^Genealogy/ }).click();
    await expect(heading(page)).toHaveText("Genealogy");
    const verses = panel(page).getByRole("list", { name: "Together in 6 verses" }).getByRole("listitem");
    await expect(verses).toHaveCount(6);
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
