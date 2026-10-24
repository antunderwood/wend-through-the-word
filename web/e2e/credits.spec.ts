import { expect, test } from "@playwright/test";
import { BUILT_TILES } from "./map";

type Source = { name: string; licence: string; link: string };

// With these flags Chromium cannot create a WebGL context: the footer and the credits page work without it.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("the footer link opens the About and credits page, which lists every source with its licence and link", async ({ page, request }) => {
  const version = (await (await request.get("/data/index.json")).json()).data_version;
  const credits = await (await request.get(`/data/${version}/credits.json`)).json();

  await page.goto("/");
  await expect(page.getByText("This browser has no WebGL")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(`Data version ${version}`);
  await page.getByRole("link", { name: "About and credits" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About and credits");
  await expect(page.getByText(credits.modified)).toBeVisible();
  await expect(page.getByRole("link", { name: "curated tables" })).toHaveAttribute("href", credits.curated_tables);
  const items = page.getByRole("list", { name: "Sources" }).getByRole("listitem");
  await expect(items).toHaveCount(credits.sources.length);
  for (const [i, s] of (credits.sources as Source[]).entries()) {
    await expect(items.nth(i).getByRole("link", { name: s.name })).toHaveAttribute("href", s.link);
    await expect(items.nth(i)).toContainText(s.licence);
  }
  // The map's tile provider, as built (decision 199), and library (#84). OpenStreetMap is credited
  // by either provider.
  const map = page.getByRole("list", { name: "Map" });
  for (const [i, c] of BUILT_TILES.credits.entries()) {
    await expect(map.getByRole("listitem").nth(i).getByRole("link", { name: c.name, exact: true })).toHaveAttribute("href", c.link);
    await expect(map.getByRole("listitem").nth(i)).toContainText(c.licence);
    if (c.licenceLink) await expect(map.getByRole("link", { name: c.licence })).toHaveAttribute("href", c.licenceLink);
  }
  await expect(map.getByRole("link", { name: "OpenStreetMap", exact: true })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(map.getByRole("listitem").filter({ hasText: "Leaflet" })).toContainText("BSD 2-Clause");
});
