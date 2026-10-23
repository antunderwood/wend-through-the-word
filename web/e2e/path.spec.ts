import { expect, test, type Page } from "@playwright/test";
import { doubleClickLabel, focusIs, openOnAbraham } from "./scene";

const SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348";

test.use({ reducedMotion: "reduce" });

test("the Your Path bar shows the Focus then Your Path newest first, and can be cleared and restored", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const bar = page.getByRole("navigation", { name: "Your Path" });
  const items = bar.getByRole("listitem");
  await expect(items).toHaveText(["Abraham"]);

  // Two Foci: Sarah from Abraham's Ring 1, then Hagar from Sarah's.
  await doubleClickLabel(page, "Sarah", SARAH);
  await doubleClickLabel(page, "Hagar", HAGAR);
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
  // Abraham is also in Hagar's Ring 1, so he is still in the scene and stays selected.
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Abraham");

  await bar.getByRole("button", { name: "Undo clear" }).click();
  await expect(items).toHaveText(["Hagar", "Sarah", "Abraham"]);
});
