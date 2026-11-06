import { expect, test, type Page } from "@playwright/test";
import { focusIs, openOnAbraham } from "./scene";

const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });

test.use({ reducedMotion: "reduce" });

test("a list of verses has a key saying which node is which, and which are not marked", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const key = panel(page).getByLabel("Key to the marks in the verses");
  // The Focus's own list names it; Isaac shares verses with it, both names in the key.
  await expect(key.first()).toContainText("Abraham");
  await panel(page).getByRole("button", { name: /^Isaac/ }).first().click();
  await expect(key.first()).toContainText("IsaacAbraham");
  // A Theme is found by no name in the text, and the key says so.
  await panel(page).getByRole("button", { name: /^Genealogy 8 verses/ }).click();
  await expect(panel(page).getByText(/GENEALOGY is not marked/)).toBeVisible();
});
