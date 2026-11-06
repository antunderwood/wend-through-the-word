import { expect, test } from "@playwright/test";
import { openOnAbraham } from "./scene";

test("Key opens the legend over the controls: each node type with its letter, and the scene's marks; Escape closes it", async ({ page }) => {
  await openOnAbraham(page);
  const key = page.getByRole("dialog", { name: "Key" });
  await expect(key).toBeHidden();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(key).toBeVisible();
  await expect(key.getByRole("list", { name: "Node types" }).getByRole("listitem")).toHaveText(["PPerson", "LLocation", "EEvent", "GPeople Group", "TTheme", "VVerse"]);
  await expect(key.getByRole("list", { name: "Scene" })).toContainText("The Focus");
  await page.keyboard.press("Escape");
  await expect(key).toBeHidden();
});
