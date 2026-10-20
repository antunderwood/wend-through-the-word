import { expect, test, type Page } from "@playwright/test";

type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
  }
}

const ABRAHAM = "person:abraham_58",
  ISAAC = "person:isaac_616";
const roleOf = (page: Page, id: string) => page.evaluate((id) => window.wendGraph!.testNodes().find((n) => n.id === id)?.role, id);
const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id);
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });

test.use({ reducedMotion: "reduce" });

test("a pinned node stays in the scene when the Focus changes, and the panel lists the Verses shared with it", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, ABRAHAM);
  await panel(page).getByRole("button", { name: "Pin", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Pinned Abraham.");

  await panel(page).getByRole("list", { name: "Person (21)" }).getByRole("button", { name: /^Isaac/ }).click();
  await panel(page).getByRole("button", { name: "Make Focus" }).click();
  await focusIs(page, ISAAC);
  expect(await roleOf(page, ABRAHAM)).toBe("pinned");
  // Shared Nodes are labelled and highlighted (fixture values in tests/model.test.ts).
  await expect(page.locator(".labels .nl.shared")).toHaveText(["Gerar", "Beer-lahai-roi", "Genealogy of Jesus", "Blessing"]);

  // Fixture: Gerar shares Gen 26:1, 26:6 and 26:20 with Isaac, and Gen 26:1 with Abraham.
  await panel(page).getByRole("list", { name: /^Place/ }).getByRole("button", { name: /^Gerar/ }).click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Gerar");
  await expect(panel(page).getByRole("list", { name: "Together in 3 verses" }).getByRole("listitem")).toHaveCount(3);
  const withAbraham = panel(page).getByRole("list", { name: "Together with Abraham in 1 verse" }).getByRole("listitem");
  await expect(withAbraham).toHaveCount(1);
  await expect(withAbraham).toContainText("Gen 26:1");

  // Unpin from the panel: Abraham stays, as one of Isaac's Ring 1.
  await page.getByRole("navigation", { name: "Your Path" }).getByRole("button", { name: "Abraham" }).click();
  await panel(page).getByRole("button", { name: "Unpin" }).click();
  await expect(page.getByRole("status")).toHaveText("Unpinned Abraham.");
  expect(await roleOf(page, ABRAHAM)).toBe("ring1");
});
