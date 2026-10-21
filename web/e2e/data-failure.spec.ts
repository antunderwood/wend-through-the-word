import { expect, test } from "@playwright/test";
import { focusIs, nodes } from "./scene";

test("a data file that fails twice shows a message and a retry, and the scene stays", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  // Gen 25's chapter file is first needed when Gen 25:5 becomes the Focus.
  await page.route("**/chapter/Gen/25.json", (r) => r.abort());
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:5");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Could not load Gen 25:5");
  expect((await nodes(page)).find((n) => n.role === "focus")!.id).toBe("person:abraham_58");

  await page.unroute("**/chapter/Gen/25.json");
  await alert.getByRole("button", { name: "Retry" }).click();
  await focusIs(page, "01025005");
  await expect(alert).toHaveCount(0);
});

test("a deploy while the page is open: the next move switches to the new data version and says so", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  const old = (await page.getByRole("contentinfo").textContent())!.match(/Data version (\S+)/)![1];
  // The deploy (decision 159): the old version's files are gone, and index.json names test2,
  // served from the old version's files.
  await page.route(`**/data/${old}/**`, (r) => r.fulfill({ status: 404 }));
  await page.route("**/data/index.json", async (r) => r.fulfill({ json: { ...(await (await r.fetch()).json()), data_version: "test2" } }));
  await page.route("**/data/test2/**", async (r) => r.fulfill({ response: await r.fetch({ url: r.request().url().replace("/test2/", `/${old}/`) }) }));
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 25:5");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await focusIs(page, "01025005");
  await expect(page.getByRole("status")).toHaveText("The data was updated to version test2. Gen 25:5 is the Focus.");
  await expect(page.getByRole("contentinfo")).toContainText("Data version test2");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a Verse outside the build is never fetched: Make Focus and Pin are refused, and the panel says why", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill("Gen 16:1");
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await focusIs(page, "01016001");
  // Gen 16:1 has a Cross-reference to Gal 4:24, outside the fixture build.
  const panel = page.getByRole("complementary", { name: "Selected Node" });
  const note = "Gal 4:24 is outside this build (Genesis, Matthew, 3 John only).";
  // Selected in the scene, so the panel also tries to list its Neighbours.
  await page.locator(".labels").getByText("Gal 4:24", { exact: true }).click();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Gal 4:24");
  await expect(panel).toContainText(note);
  await expect(panel).not.toContainText("Could not load");

  await panel.getByRole("button", { name: "Make Focus" }).click();
  await expect(page.getByRole("status")).toHaveText(note);
  // Prev changes the notice, so the Pin notice below is a new one.
  await panel.getByRole("button", { name: "Prev" }).click();
  await expect(page.getByRole("status")).toHaveText("Gal 4:24 is not on Your Path.");
  await panel.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(note);
  await expect(panel.getByRole("button", { name: "Unpin" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await nodes(page)).find((n) => n.role === "focus")!.id).toBe("01016001");
  expect(asked.filter((u) => u.includes("/Gal/"))).toEqual([]);
});

test("a panel list that fails twice shows a message and a retry", async ({ page }) => {
  await page.goto("/");
  await focusIs(page, "person:abraham_58");
  // Ur's file is first needed when Ur is selected: for its Neighbours and the Verses it shares with Abraham.
  await page.route("**/entity/place/ur_1189.json", (r) => r.abort());
  const panel = page.getByRole("complementary", { name: "Selected Node" });
  await page.locator(".labels").getByText("Ur of the Chaldees", { exact: true }).click();
  await expect(panel).toContainText("Could not load the Neighbours");
  await expect(panel).toContainText("Could not load the shared verses");

  await page.unroute("**/entity/place/ur_1189.json");
  await panel.getByRole("button", { name: "Retry" }).first().click();
  await expect(panel.getByRole("list", { name: "Person (7)" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Together in 1 verse" })).toBeVisible();
  await expect(panel).not.toContainText("Could not load");
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
