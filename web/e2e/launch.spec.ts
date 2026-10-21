import { expect, test, type Page } from "@playwright/test";

// Launch polish (#50): the tab title, the link preview, the icon, and the not found page.
const TITLE = "Wend Through the Word";
const meta = (page: Page, key: string) => page.locator(`meta[name="${key}"], meta[property="${key}"]`).getAttribute("content");

for (const [path, title] of [
  ["/", TITLE],
  ["/credits.html", `${TITLE}: about and credits`],
]) {
  test(`${path} has the title, a description, a link preview, and the icon`, async ({ page, request }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    const description = await meta(page, "description");
    expect(description).toMatch(/\w/);
    expect(await meta(page, "og:title")).toBe(title);
    expect(await meta(page, "og:description")).toBe(description);
    expect(`${title} ${description}`).not.toMatch(/[\u2013\u2014]/);

    // The SVG icon, a PNG one for browsers without SVG icons, and the Apple touch icon.
    const links = page.locator('link[rel="icon"], link[rel="apple-touch-icon"]');
    const types = [];
    for (const href of await links.evaluateAll((ls) => ls.map((l) => l.getAttribute("href")!))) {
      const icon = await request.get(href);
      expect(icon.status(), href).toBe(200);
      types.push(icon.headers()["content-type"]);
    }
    expect(types).toEqual(["image/svg+xml", "image/png", "image/png"]);
  });
}

test("the not found page has a message and a link back to the graph, under the credits page's title style", async ({ page }) => {
  const titleStyle = () =>
    page.getByRole("heading", { level: 1 }).evaluate((h) => {
      const s = getComputedStyle(h);
      return [s.fontFamily, s.fontSize, s.fontWeight, s.color, getComputedStyle(document.body).backgroundColor];
    });
  await page.goto("/credits.html");
  const credits = await titleStyle();

  await page.goto("/404.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.getByText("There is no page at this address.")).toBeVisible();
  expect(await titleStyle()).toEqual(credits);
  await page.getByRole("link", { name: "Back to the graph" }).click();
  await expect(page).toHaveURL(/\/$/);
});
