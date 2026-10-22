import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, themesOnScreen, type OnScreen } from "./scene";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const filters = (page: Page) => page.getByRole("dialog", { name: "Filters" });
const search = (page: Page) => new URL(page.url()).search;

async function open(page: Page, address = "/") {
  await page.goto(address);
  await focusIs(page, ABRAHAM);
  await page.getByRole("button", { name: "Filters" }).click();
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("turning Themes off removes them from the scene and the lists, and the address keeps it", async ({ page }) => {
    await open(page);
    // With an Entity as the Focus the Vote Limit only reaches Ring 2.
    await expect(filters(page)).toContainText("Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength.");
    await expect(filters(page)).toContainText("only changes Ring 2");
    // Fixture: Abraham has 36 Themes.
    await expect(panel(page).getByRole("list", { name: "Theme (37)" })).toBeVisible();
    expect(await themesOnScreen(page)).toBeGreaterThan(0);

    await filters(page).getByRole("checkbox", { name: "Themes" }).uncheck();
    await expect.poll(() => themesOnScreen(page)).toBe(0);
    await expect(panel(page).getByRole("list", { name: /^Theme/ })).toHaveCount(0);
    await expect.poll(() => search(page)).toBe("?hide=theme");

    // Opening that address restores it.
    await page.reload();
    await focusIs(page, ABRAHAM);
    expect(await themesOnScreen(page)).toBe(0);
    await expect(panel(page).getByRole("list", { name: /^Theme/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(filters(page).getByRole("checkbox", { name: "Themes" })).not.toBeChecked();
  });
});

test("an address with several books says so in the book filter", async ({ page }) => {
  await open(page, "/?focus=person:abraham_58&books=Gen,3John");
  await expect(filters(page).getByRole("combobox", { name: "Verses from" }).locator("option:checked")).toHaveText("Several books: Genesis, 3 John");
});

test("the book filter leaves the Verses two nodes share, as they are the evidence for their link", async ({ page }) => {
  // Decision 136: Genealogy is together with Abraham in 6 Genesis verses, with only Matthew chosen.
  await open(page, "/?focus=person:abraham_58&books=Matt");
  await page.keyboard.press("Escape");
  await panel(page).getByRole("list", { name: "Theme (37)" }).getByRole("button", { name: /^Genealogy/ }).click();
  await expect(panel(page).getByRole("list", { name: "Together in 8 verses" }).getByRole("listitem")).toHaveCount(8);
});

test("the animation switch stops the camera flight and the growth", async ({ page }) => {
  await open(page);
  await filters(page).getByRole("checkbox", { name: "Animation" }).uncheck();
  await page.keyboard.press("Escape");
  await expect(filters(page)).toBeHidden();
  const sarah = (await nodes(page)).find((n) => n.id === SARAH)!;
  await page.mouse.dblclick(sarah.x, sarah.y);
  // The first frame already has Sarah at the centre and her Ring 1 in place, as under reduced motion.
  const frame = (await page
    .waitForFunction(
      (id) => {
        const ns = window.wendGraph?.testNodes() ?? [];
        return ns.find((n) => n.role === "focus")?.id === id && ns;
      },
      SARAH,
      { polling: "raf" },
    )
    .then((h) => h.jsonValue())) as OnScreen[];
  const focus = frame.find((n) => n.role === "focus")!;
  // The centre of the scene, which lies between the panels.
  const b = (await page.getByRole("application").boundingBox())!;
  const centre = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  expect(Math.hypot(focus.x - centre.x, focus.y - centre.y)).toBeLessThan(2);
  expect(Math.max(...frame.filter((n) => n.role === "ring1").map((n) => Math.hypot(n.x - focus.x, n.y - focus.y)))).toBeGreaterThan(100);
});
