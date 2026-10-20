import { expect, test, type Page } from "@playwright/test";
import { nodes } from "./scene";

const ISAAC = "person:isaac_616";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
});

test("a click on a disc selects that node, even under another node's label", async ({ page }) => {
  // In the tilted plane Sarah's label lies over Isaac's disc.
  const isaac = (await nodes(page)).find((n) => n.id === ISAAC)!;
  await page.mouse.click(isaac.x, isaac.y);
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
});

test("the Focus edges carry the Relationship, and a Co-mention reads together in N verses", async ({ page }) => {
  const words = page.locator(".labels .el");
  // Fixture: Abraham SPOUSE_OF Sarah (Female); Abraham and Genealogy (Theme) only share 6 Verses.
  await expect(words.getByText("wife", { exact: true })).toBeVisible();
  await expect(words.getByText("together in 6 verses", { exact: true })).toBeVisible();
  await expect(words.getByText("together in 6 verses", { exact: true })).toHaveClass(/derived/);
});

test("the Focus shows the first line of its Dictionary Entry", async ({ page }) => {
  // Fixture: Abraham's Easton entry starts "Father of a multitude, son of Terah, named (Gen. 11:27)..."
  await expect(page.locator(".nl.focus")).toContainText("Father of a multitude, son of Terah");
});

test("hovering a Ring 2 node shows its name and its path to the Focus, until the pointer leaves", async ({ page }) => {
  // Fixture: Jacob (Israel) is Isaac's first Ring 2 neighbour.
  const jacob = (await nodes(page)).find((n) => n.id === "person:israel_682")!;
  expect(jacob.role).toBe("ring2");
  const tip = page.getByRole("tooltip");
  await page.mouse.move(jacob.x, jacob.y);
  await expect(tip).toHaveText("Jacob (Israel) → Isaac → Abraham");
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();
});

for (const view of ["Tilted plane", "Stacked discs", "Free orbit"])
  test(`far nodes lose their labels, near nodes keep them: ${view}`, async ({ page }) => {
    await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: view }).click();
    const isaac = page.locator(".labels .nl").getByText("Isaac", { exact: true });
    await expect(isaac).toBeVisible();
    // The wheel goes straight to the scene's canvas: page.mouse.wheel waits for each event to be
    // handled, which a page drawing every frame can starve under load.
    const wheel = (deltaY: number) =>
      page.locator("canvas").evaluate((c, deltaY) => {
        for (let i = 0; i < 20; i++) c.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
      }, deltaY);
    await wheel(400); // zoom out as far as the view allows
    // Only the Focus keeps its name (and its first line).
    await expect(page.locator(".labels .nl:visible")).toHaveText([/^Abraham/]);
    await wheel(-400);
    await expect(isaac).toBeVisible();
  });
