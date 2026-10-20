import { expect, test, type Page } from "@playwright/test";

type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
  }
}

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473";
const nodes = (page: Page) => page.evaluate(() => window.wendGraph!.testNodes());
const node = async (page: Page, id: string) => (await nodes(page)).find((n) => n.id === id)!;
// The first frame drawn with id as the Focus.
const firstFrameWith = async (page: Page, id: string) =>
  (await page.waitForFunction(
    (id) => {
      const ns = window.wendGraph?.testNodes() ?? [];
      return ns.find((n) => n.role === "focus")?.id === id && ns;
    },
    id,
    { polling: "raf" },
  ).then((h) => h.jsonValue())) as OnScreen[];
const centre = (page: Page) => ({ x: page.viewportSize()!.width / 2, y: page.viewportSize()!.height / 2 });
const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

async function open(page: Page) {
  await page.goto("/");
  await firstFrameWith(page, ABRAHAM);
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a click selects a Ring 1 Person and leaves the scene; Make Focus moves the Focus", async ({ page }) => {
    await open(page);
    const before = await nodes(page);
    const sarah = before.find((n) => n.id === SARAH)!;
    expect(sarah.role).toBe("ring1");
    await page.mouse.click(sarah.x, sarah.y);

    const panel = page.getByRole("complementary", { name: "Selected Node" });
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Sarah");
    // Fixture: Abraham SPOUSE_OF Sarah, and Sarah is Female.
    await expect(panel).toContainText("Person");
    await expect(panel).toContainText("wife");
    expect(await nodes(page)).toEqual(before);

    await panel.getByRole("button", { name: "Make Focus" }).click();
    // No flight and no growth: the first frame already has Sarah at the centre and her Ring 1 in place.
    const frame = await firstFrameWith(page, SARAH);
    const focus = frame.find((n) => n.role === "focus")!;
    expect(far(focus, centre(page))).toBeLessThan(2);
    expect(Math.max(...frame.filter((n) => n.role === "ring1").map((n) => far(n, focus)))).toBeGreaterThan(100);
    await expect(page.getByRole("status")).toHaveText("Sarah is the Focus.");
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Sarah");
    await expect(panel.getByRole("button", { name: "Make Focus" })).toBeDisabled();
  });

  test("a double click on a node makes it the Focus", async ({ page }) => {
    await open(page);
    const sarah = await node(page, SARAH);
    await page.mouse.dblclick(sarah.x, sarah.y);
    await firstFrameWith(page, SARAH);
    // Abraham is now on Your Path and in Sarah's Ring 1.
    expect((await node(page, ABRAHAM)).role).toBe("ring1");
  });
});

test("the camera flies to the new Focus and new nodes grow out of it", async ({ page }) => {
  await open(page);
  const sarah = await node(page, SARAH);
  await page.mouse.dblclick(sarah.x, sarah.y);
  // The first frame: the camera has not moved yet, and every new node starts at the clicked node.
  const frame = await firstFrameWith(page, SARAH);
  const focus = frame.find((n) => n.role === "focus")!;
  expect(far(focus, sarah)).toBeLessThan(30);
  expect(Math.max(...frame.filter((n) => n.role === "ring1").map((n) => far(n, focus)))).toBeLessThan(30);
  // Then the camera arrives with Sarah at the centre.
  await expect.poll(async () => far(await node(page, SARAH), centre(page)), { timeout: 3000 }).toBeLessThan(2);
});

test("the hint can be dismissed and stays dismissed after a reload", async ({ page }) => {
  await open(page);
  const hint = page.getByText("A click selects a node");
  await expect(hint).toBeVisible();
  await page.getByRole("button", { name: "Dismiss hint" }).click();
  await expect(hint).toBeHidden();
  await open(page);
  await expect(hint).toBeHidden();
});

test("the page works when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    }),
  );
  await open(page);
  await page.getByRole("button", { name: "Dismiss hint" }).click();
  await expect(page.getByText("A click selects a node")).toBeHidden();
});
