import { expect, test } from "@playwright/test";
import { box, overlaps } from "./boxes";
import { focusIs, openOnAbraham } from "./scene";

// The dock along the bottom of the drawer and the scene (decision 209): the notes and the footer
// never run into the view picker, Filters, or Copy link, nor any of them into the panel, at a wide
// window, a laptop, and a tablet's width, with the reader drawer open or closed.
for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]) {
  test(`the footer, the notice, and the controls do not overlap at ${size.width} x ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openOnAbraham(page);
    await focusIs(page, "person:abraham_58");
    const panel = page.getByRole("complementary", { name: "Selected Node" });
    const parts = async () => [
      await box("footer", page.getByRole("contentinfo")),
      await box("picker", page.getByRole("radiogroup", { name: "View" })),
      await box("Filters", page.getByRole("button", { name: "Filters" })),
      await box("Copy link", page.getByRole("button", { name: "Copy link" })),
      await box("notice", page.getByRole("status")),
      await box("panel", panel),
    ];
    // A move writes the notice line.
    await panel.getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Sarah/ }).dblclick();
    await expect(page.getByRole("status")).toHaveText("Sarah is the Focus.");
    expect(overlaps(await parts())).toEqual([]);

    await panel.getByRole("button", { name: "Read", exact: true }).click();
    const reader = page.getByRole("region", { name: "Reader" });
    await expect(reader).toBeVisible();
    expect(overlaps([...(await parts()), await box("reader", reader)])).toEqual([]);
  });
}
