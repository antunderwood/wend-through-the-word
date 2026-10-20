import { expect, test, type Page } from "@playwright/test";

type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
  }
}

const SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348";
const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id);
async function doubleClick(page: Page, id: string) {
  const n = (await page.evaluate(() => window.wendGraph!.testNodes())).find((n) => n.id === id)!;
  await page.mouse.dblclick(n.x, n.y);
  await focusIs(page, id);
}

test.use({ reducedMotion: "reduce" });

test("the Your Path bar shows the Focus then Your Path newest first, and can be cleared and restored", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  const bar = page.getByRole("navigation", { name: "Your Path" });
  const items = bar.getByRole("listitem");
  await expect(items).toHaveText(["Abraham"]);

  // Two Foci: Sarah from Abraham's Ring 1, then Hagar from Sarah's.
  await doubleClick(page, SARAH);
  await doubleClick(page, HAGAR);
  await expect(items).toHaveText(["Hagar", "Sarah", "Abraham"]);

  // A click selects without moving the Focus; Next steps towards the Focus.
  const panel = page.getByRole("complementary", { name: "Selected Node" });
  await items.getByText("Abraham").click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Sarah");
  await panel.getByRole("button", { name: "Prev", exact: true }).click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");
  await focusIs(page, HAGAR);

  await bar.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(items).toHaveText(["Hagar"]);
  // Abraham was on Your Path and is not pinned, so the selection gives way to the Focus.
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Hagar");

  await bar.getByRole("button", { name: "Undo clear" }).click();
  await expect(items).toHaveText(["Hagar", "Sarah", "Abraham"]);
});
