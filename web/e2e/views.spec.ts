import { expect, test, type Page } from "@playwright/test";

const ABRAHAM = "person:abraham_58";
const drawn = (page: Page) => page.evaluate(() => window.wendGraph!.testNodes());
const sceneReady = (page: Page) => page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });

test("the picker switches A to B to C with the keyboard, keeping the Focus and every node", async ({ page }) => {
  await page.goto("/");
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  const before = await drawn(page);
  const ids = before.map((n) => n.id).sort();
  const isaacAt = async () => (await drawn(page)).find((n) => n.id === "person:isaac_616");

  await picker(page).getByRole("radio", { name: "Tilted plane" }).focus();
  let last = await isaacAt();
  for (const [key, name] of [
    ["ArrowRight", "Stacked discs"],
    ["ArrowRight", "Free orbit"],
    ["ArrowLeft", "Stacked discs"],
  ]) {
    await page.keyboard.press(key);
    const radio = picker(page).getByRole("radio", { name });
    await expect(radio).toBeChecked();
    await expect(radio).toBeFocused();
    // The view moved the nodes, but the Scene is the same: Abraham the Focus, 99 nodes.
    await expect.poll(isaacAt).not.toEqual(last);
    last = await isaacAt();
    const now = await drawn(page);
    expect(now.find((n) => n.role === "focus")!.id).toBe(ABRAHAM);
    expect(now.map((n) => n.id).sort()).toEqual(ids);
  }
});

test("the chosen view survives a reload", async ({ page }) => {
  await page.goto("/");
  await sceneReady(page);
  await picker(page).getByRole("radio", { name: "Free orbit" }).click();
  await page.reload();
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Free orbit");
});

test("blocked storage falls back to the tilted plane without an error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  await picker(page).getByRole("radio", { name: "Stacked discs" }).click();
  await expect(picker(page).getByRole("radio", { name: "Stacked discs" })).toBeChecked();
  expect(errors).toEqual([]);
});
