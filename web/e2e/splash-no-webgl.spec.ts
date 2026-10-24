import { expect, test } from "@playwright/test";
import { firstVisit, splash, start, takeTour } from "./splash";

// With these flags Chromium cannot create a WebGL context, as on a device without WebGL.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("without WebGL the splash shows, has no tour to take, and Start exploring leaves the panel alone", async ({ page }) => {
  await firstVisit(page);
  await page.goto("/");
  // The tour needs the scene, as the footer's link does: once the page finds no WebGL, no button for it.
  await expect(page.getByText("This browser has no WebGL")).toBeVisible();
  await expect(takeTour(page)).toBeHidden();
  await start(page).click();
  await expect(splash(page)).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Selected Node" }).getByRole("heading", { level: 2 })).toHaveText("Jesus Christ");
});
