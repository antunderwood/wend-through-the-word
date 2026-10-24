import { expect, test } from "@playwright/test";
import { firstVisit, splash, start } from "./splash";

// With these flags Chromium cannot create a WebGL context, as on a device without WebGL.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("without WebGL the splash shows and Start exploring leaves the panel alone", async ({ page }) => {
  await firstVisit(page);
  await page.goto("/");
  await start(page).click();
  await expect(splash(page)).toBeHidden();
  await expect(page.getByText("This browser has no WebGL")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 })).toHaveText("Jesus Christ");
});
