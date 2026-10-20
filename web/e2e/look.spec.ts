import { expect, test, type Page } from "@playwright/test";

type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
    wendApply?: (a: { type: "setFilter"; key: "nodeLimit"; value: number }) => void;
  }
}

const ISAAC = "person:isaac_616";
const nodes = (page: Page) => page.evaluate(() => window.wendGraph!.testNodes());
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
  await expect(panel(page).getByRole("heading")).toHaveText("Isaac");
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

test("a corner note says how many nodes the node limit hid", async ({ page }) => {
  const note = page.getByText(/hidden to keep the view fast/);
  await expect(note).toBeHidden();
  // Fixture: at a node limit of 60, Abraham's 99 node scene loses 39 Ring 2 nodes (tests/model.test.ts).
  await page.evaluate(() => window.wendApply!({ type: "setFilter", key: "nodeLimit", value: 60 }));
  await expect(note).toHaveText("39 faint nodes hidden to keep the view fast");
  expect(await nodes(page)).toHaveLength(60);
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

test("far nodes lose their labels, near nodes keep them", async ({ page }) => {
  const isaac = page.locator(".labels .nl").getByText("Isaac", { exact: true });
  await expect(isaac).toBeVisible();
  // Over the Focus's name, which passes the wheel on to the scene.
  const focus = (await nodes(page)).find((n) => n.role === "focus")!;
  await page.mouse.move(focus.x, focus.y + 30);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 400); // zoom out as far as the view allows
  await expect(isaac).toBeHidden();
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -400);
  await expect(isaac).toBeVisible();
});
