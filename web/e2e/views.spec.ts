import { expect, test, type Page } from "@playwright/test";
import { nodes, openOnAbraham } from "./scene";
import { start } from "./splash";

const ABRAHAM = "person:abraham_58";
const sceneReady = (page: Page) => page.waitForFunction(() => (window.wendGraph?.testNodes().length ?? 0) > 0);
const picker = (page: Page) => page.getByRole("radiogroup", { name: "View" });

test("the picker switches A to B to C with the keyboard, keeping the Focus and every node", async ({ page }) => {
  await openOnAbraham(page);
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  const before = await nodes(page);
  const ids = before.map((n) => n.id).sort();
  const isaacAt = async () => (await nodes(page)).find((n) => n.id === "person:isaac_616");

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
    // The view moved the nodes, but the Scene is the same: Abraham the Focus, 105 nodes.
    await expect.poll(isaacAt).not.toEqual(last);
    last = await isaacAt();
    const now = await nodes(page);
    expect(now.find((n) => n.role === "focus")!.id).toBe(ABRAHAM);
    expect(now.map((n) => n.id).sort()).toEqual(ids);
  }
});

test("the chosen view is kept in this browser", async ({ page }) => {
  await openOnAbraham(page);
  await sceneReady(page);
  await picker(page).getByRole("radio", { name: "Free orbit" }).click();
  // The bare address, not a reload: a reload would keep the view through the address.
  await page.goto("/");
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
  await start(page).click(); // with nothing kept, the splash shows on each visit (decision 202)
  await sceneReady(page);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  await picker(page).getByRole("radio", { name: "Stacked discs" }).click();
  await expect(picker(page).getByRole("radio", { name: "Stacked discs" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("a window narrowed to 640 px shows the stacked discs as the tilted plane, until widened", async ({ page }) => {
  const isaacAt = async () => (await nodes(page)).find((n) => n.id === "person:isaac_616");
  // Where the tilted plane puts Isaac in a narrow window.
  await page.setViewportSize({ width: 640, height: 720 });
  await openOnAbraham(page);
  await sceneReady(page);
  const tilted = await isaacAt();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?view=B");
  await sceneReady(page);
  const radios = picker(page).getByRole("radio");
  await expect(radios).toHaveText(["Tilted plane", "Stacked discs", "Free orbit"]);
  const discs = await isaacAt();

  // The phone views (docs/specs/mobile.md): the address keeps the stacked discs.
  await page.setViewportSize({ width: 640, height: 720 });
  await expect(radios).toHaveText(["Tilted plane", "Free orbit"]);
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Tilted plane");
  await expect.poll(isaacAt).toEqual(tilted);
  expect(new URL(page.url()).searchParams.get("view")).toBe("B");

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(picker(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Stacked discs");
  await expect.poll(isaacAt).toEqual(discs);
});
