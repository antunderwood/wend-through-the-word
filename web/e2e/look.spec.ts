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

test("only the Selected Node's edge and a hovered node's carry Relationship words; a Theme's Co-mention shows only its Verse count", async ({ page }) => {
  const words = page.locator(".labels .el:visible");
  // Abraham is the Focus and the Selected Node: no words.
  await expect(words).toHaveCount(0);
  // Fixture: Abraham SPOUSE_OF Sarah (Female); Abraham and God (topic), a Theme, only share 3
  // Verses, and a Theme's words never vary, so only the count shows (decision 141).
  await page.locator(".labels").getByText("Sarah", { exact: true }).click();
  await expect(words).toHaveText(["wife"]);
  const god = (await nodes(page)).find((n) => n.id === "theme:god")!;
  await page.mouse.move(god.x, god.y);
  await expect(words).toHaveText(["wife", "3 verses"]);
  await expect(words.getByText("3 verses", { exact: true })).toHaveClass(/derived/);
  await page.mouse.move(5, 5);
  await expect(words).toHaveText(["wife"]);
});

test("the Focus shows the first line of its Dictionary Entry", async ({ page }) => {
  // Fixture: Abraham's Easton entry starts "Father of a multitude, son of Terah, named (Gen. 11:27)..."
  await expect(page.locator(".nl.focus")).toContainText("Father of a multitude, son of Terah");
});

test("hovering a Ring 2 node shows its name and its path to the Focus, until the pointer leaves", async ({ page }) => {
  // Fixture: Rebekah is Isaac's first Ring 2 neighbour (Jacob, his first, is in Ring 1).
  const rebekah = (await nodes(page)).find((n) => n.id === "person:rebekah_2401")!;
  expect(rebekah.role).toBe("ring2");
  const tip = page.getByRole("tooltip");
  await page.mouse.move(rebekah.x, rebekah.y);
  await expect(tip).toHaveText("Rebekah → Isaac → Abraham");
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
