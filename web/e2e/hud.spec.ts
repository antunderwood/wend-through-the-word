import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, openOnAbraham } from "./scene";

const ABRAHAM = "person:abraham_58";
const hud = (page: Page) => page.getByRole("region", { name: "Selected Node HUD" });
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const toggle = (page: Page) => page.getByRole("button", { name: "HUD" });

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
});

test("the HUD shows the Selected Node over the scene in place of the panel, and the choice is kept", async ({ page }) => {
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(hud(page)).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await expect(hud(page).getByText("Focus", { exact: true })).toBeVisible();
  // The Focus offers no Make Focus; its links are counted by type.
  await expect(hud(page).getByRole("button", { name: "Make Focus" })).toHaveCount(0);
  await expect(hud(page).getByText("Themes")).toBeVisible();
  // The panel slides away and the scene takes the whole width.
  await expect.poll(async () => (await panel(page).boundingBox())!.x).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);

  // A Ring 1 node selected in the scene shows on the HUD.
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.mouse.click(isaac.x, isaac.y);
  await expect(hud(page).getByRole("heading", { level: 2 })).toHaveText("Isaac");
  await expect(hud(page).getByRole("button", { name: "Make Focus" })).toBeEnabled();

  await page.reload();
  await expect(hud(page)).toBeVisible();

  // Details goes back to the full panel.
  await hud(page).getByRole("button", { name: "Details" }).click();
  await expect(hud(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await panel(page).boundingBox())!.x).toBeLessThan(page.viewportSize()!.width - 300);
});

test("Make Focus on the HUD moves the Focus", async ({ page }) => {
  await toggle(page).click();
  const isaac = (await nodes(page)).find((n) => n.id === "person:isaac_616")!;
  await page.mouse.click(isaac.x, isaac.y);
  await hud(page).getByRole("button", { name: "Make Focus" }).click();
  await focusIs(page, "person:isaac_616");
  await expect(hud(page).getByText("Focus", { exact: true })).toBeVisible();
});
