import { expect, test, type Page } from "@playwright/test";

const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id, { polling: "raf" });

test("a data file that fails twice shows a message and a retry, and the scene stays", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  // Gen 25's chapter file is first needed when Gen 25:5 becomes the Focus.
  await page.route("**/chapter/Gen/25.json", (r) => r.abort());
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:5");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Could not load Gen 25:5");
  expect((await page.evaluate(() => window.wendGraph!.testNodes())).find((n) => n.role === "focus")!.id).toBe("person:abraham_58");

  await page.unroute("**/chapter/Gen/25.json");
  await alert.getByRole("button", { name: "Retry" }).click();
  await focusIs(page, "01025005");
  await expect(alert).toHaveCount(0);
});

test("a failed first load shows a message and a retry in place of the scene", async ({ page }) => {
  await page.route("**/search-index.json", (r) => r.abort());
  await page.goto("/");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Could not load the data");

  await page.unroute("**/search-index.json");
  await alert.getByRole("button", { name: "Retry" }).click();
  await focusIs(page, "person:abraham_58");
  await expect(alert).toHaveCount(0);
});
