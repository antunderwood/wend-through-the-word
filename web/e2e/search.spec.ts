import { expect, test, type Page } from "@playwright/test";
import { openOnAbraham } from "./scene";

const focusOf = (page: Page) => page.evaluate(() => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id);

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await openOnAbraham(page);
  await expect.poll(() => focusOf(page)).toBe("person:abraham_58");
});

test('a click on a search result makes it the Focus at once and closes the list: "Abraham"', async ({ page }) => {
  const box = page.getByRole("searchbox", { name: "Search" });
  const results = page.getByRole("list", { name: "Search results" });
  // The page opens on Abraham, so move away first.
  await box.fill("Isaac");
  await results.getByRole("button").first().click();
  await expect.poll(() => focusOf(page)).toBe("person:isaac_616");

  await box.fill("Abraham");
  const first = results.getByRole("button").first();
  await expect(first).toContainText("Abraham");
  await first.click();
  await expect.poll(() => focusOf(page)).toBe("person:abraham_58");
  await expect(box).toHaveValue("");
  await expect(results).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Abraham is the Focus.");
});

test("Enter picks the first result, within the chosen type", async ({ page }) => {
  const box = page.getByRole("searchbox", { name: "Search" });
  // Fixture: Canaan is a Person and a Place; the Person comes first with no type chosen.
  await box.fill("Canaan");
  await page.getByRole("group", { name: "Filter by type" }).getByRole("button", { name: "Location" }).click();
  // A Place's result names its type Location (decision 200).
  await expect(page.getByRole("list", { name: "Search results" }).getByRole("button").first()).toHaveText(/^Canaan.*Location$/);
  await box.press("Enter");
  await expect.poll(() => focusOf(page)).toBe("place:canaan_272");
  await expect(page.getByRole("list", { name: "Search results" })).toBeHidden();
});

test("search results, the scene label, and the panel tell same-name Entities apart", async ({ page }) => {
  // Fixture: People named Anah (decisions 122, 125).
  await page.getByRole("searchbox", { name: "Search" }).fill("Anah");
  await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Anah, father of Dishon \(Gen 36:24\)/ }).click();
  await expect.poll(() => focusOf(page)).toBe("person:anah_249");
  await expect(page.locator(".labels").getByText("Anah, father of Dishon (Gen 36:24)", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 })).toHaveText("Anah, father of Dishon (Gen 36:24)");
});

// The placeholder fits the box on a desktop, uncut (UI review finding 5).
test("the search placeholder fits its box", async ({ page }) => {
  const input = page.getByRole("search").getByRole("searchbox", { name: "Search" });
  await expect(input).toHaveAttribute("placeholder", "Search people, places, verses");
  const [text, room] = await input.evaluate((el: HTMLInputElement) => {
    const css = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = css.font;
    return [ctx.measureText(el.placeholder).width, el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)];
  });
  expect(text).toBeLessThanOrEqual(room);
});

// One top bar on a desktop: the search field and Your Path lie inside it, nothing hangs below it,
// and the type chips show only while the box is in use (decision 211).
test("the search field and Your Path lie in one top bar, and the type chips drop below it in use", async ({ page }) => {
  const search = page.getByRole("search");
  const path = page.getByRole("navigation", { name: "Your Path" });
  const chips = page.getByRole("group", { name: "Filter by type" });
  for (const box of [await search.boundingBox(), await path.boundingBox()]) {
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(56);
  }
  expect(Math.abs((await search.boundingBox())!.y - (await path.boundingBox())!.y)).toBeLessThan(1);
  await expect(chips).toBeHidden();

  await page.getByRole("searchbox", { name: "Search" }).click();
  await expect(chips).toBeVisible();
  expect((await chips.boundingBox())!.y).toBeGreaterThanOrEqual(56);
  await page.keyboard.press("Escape");
  await expect(chips).toBeHidden();

  await page.getByRole("searchbox", { name: "Search" }).fill("Isaac");
  await expect(chips).toBeVisible();
  await page.getByRole("application").click({ position: { x: 20, y: 300 } });
  await expect(chips).toBeHidden();
});
