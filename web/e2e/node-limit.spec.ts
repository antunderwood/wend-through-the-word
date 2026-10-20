import { expect, test } from "@playwright/test";

// The frame rate under software WebGL means nothing, so no test reads its value (the owner runs
// the page on a laptop).
test("the node limit page measures each view and gives the results as text", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href*="node-limit"]')).toHaveCount(0); // not linked from the reader's page

  await page.goto("/node-limit.html");
  const results = page.getByRole("textbox", { name: "Results" });
  const record = page.getByRole("button", { name: "Record" });
  for (const [view, choice, nodes] of [
    ["A", "100 nodes", "100"],
    ["B", "1000 nodes", "1000"],
    // Fixture stand-in: Egypt is in the fixture export with 33 nodes, none hidden at limit 500.
    ["C", "Egypt", "33"],
  ]) {
    await page.getByRole("radio", { name: view, exact: true }).check();
    await page.getByLabel("Scene").selectOption({ label: choice });
    await expect(page.getByTestId("nodes")).toHaveText(nodes);
    await page.waitForFunction((n) => (window as { wendGraph?: { testNodes(): unknown[] } }).wendGraph?.testNodes().length === n, +nodes);
    await expect(page.getByTestId("fps")).toHaveText(/^\d+(\.\d)? fps/);
    await record.click();
  }
  await page.getByRole("checkbox", { name: "Glow" }).uncheck();
  await page.getByLabel("Node limit").fill("20");
  await expect(page.getByTestId("hidden")).toHaveText("13");
  await expect(page.getByTestId("fps")).toHaveText(/^\d+(\.\d)? fps/);
  await record.click();

  const lines = (await results.inputValue()).trimEnd().split("\n");
  expect(lines.slice(-4).map((l) => l.replace(/ +\S+ fps$/, "").split(/ {2,}/))).toEqual([
    ["A", "100 nodes", "100", "103", "3", "glow on", "no fog", "still"],
    ["B", "1000 nodes", "1000", "1015", "15", "glow on", "no fog", "still"],
    ["C", "Egypt", "33", "33", "0", "glow on", "fog on", "still"],
    ["C", "Egypt", "20", "33", "13", "glow off", "fog on", "still"],
  ]);
});
