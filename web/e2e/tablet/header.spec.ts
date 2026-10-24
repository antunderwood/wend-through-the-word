import { expect, test } from "@playwright/test";
import { focusIs, openOnAbraham } from "../scene";

test("a tablet keeps the desktop panel: the header stays at the top while the column scrolls behind it", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, "person:abraham_58");
  const panel = page.getByRole("complementary", { name: "Selected Node" });
  const name = panel.getByRole("heading", { level: 2 });
  const top = (await name.boundingBox())!.y;
  await panel.getByRole("button", { name: "Read more" }).tap();
  await panel.evaluate((p) => p.scrollTo(0, p.scrollHeight));
  expect(await panel.evaluate((p) => p.scrollTop)).toBeGreaterThan(0);
  expect((await name.boundingBox())!.y).toBe(top);
  // A tap on Pin, held in the header, still reaches it.
  await panel.getByRole("button", { name: "Pin", exact: true }).tap();
  await expect(panel.getByRole("button", { name: "Unpin" })).toBeInViewport();
});
