import { expect, test } from "@playwright/test";
import { focusIs, nodes } from "./scene";
import { tourBoxSpecs } from "./tour-box";

// A small desktop window, where the box has least room.
tourBoxSpecs([{ width: 800, height: 600 }], ["A"],
  false,
);

// The graph module's panTo, which the tour uses when no place for the box keeps clear of the node.
test("panTo puts a node's disc where asked, zoomed out if asked, a click there picks it, and a new view goes back to the start", async ({ page }) => {
  const GOD = "person:god_1324",
    JESUS = "person:jesus_905";
  await page.goto("/");
  await focusIs(page, JESUS);
  const rect = (id: string) => page.evaluate((id) => window.wendGraph!.nodeRect(id)!.toJSON() as DOMRect, id);
  const focus = async () => (await nodes(page)).find((n) => n.role === "focus")!;
  const start = await focus(),
    before = await rect(GOD);
  await page.evaluate((id) => window.wendGraph!.panTo(id, 300, 250), GOD);
  let d = await rect(GOD);
  expect(d.x + d.width / 2).toBeCloseTo(300, 0);
  expect(d.y + d.height / 2).toBeCloseTo(250, 0);
  expect(d.width).toBeCloseTo(before.width, 1);
  // Its name follows on the next frame drawn.
  const name = page.locator(`.labels [data-node="${GOD}"]`);
  await expect
    .poll(async () => {
      const b = (await name.boundingBox())!;
      return Math.abs(b.x + b.width / 2 - 300);
    })
    .toBeLessThan(2);

  await page.evaluate((id) => window.wendGraph!.panTo(id, 300, 250, 1.25), GOD);
  d = await rect(GOD);
  expect(d.x + d.width / 2).toBeCloseTo(300, 0);
  expect(d.y + d.height / 2).toBeCloseTo(250, 0);
  expect(d.width).toBeLessThan(before.width / 1.2);

  await page.mouse.click(300, 250);
  await expect(page.locator(".labels .nl.selected")).toHaveAttribute("data-node", GOD);

  const view = page.getByRole("radiogroup", { name: "View" });
  await view.getByRole("radio", { name: "Free orbit" }).click();
  await view.getByRole("radio", { name: "Tilted plane" }).click();
  await expect.poll(focus).toEqual(start);
});
