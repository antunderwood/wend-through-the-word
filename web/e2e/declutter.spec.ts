import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes } from "./scene";

const ABRAHAM = "person:abraham_58",
  ISAAC = "person:isaac_616";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });

test.use({ reducedMotion: "reduce" });

// The names and Relationship words showing, with their boxes on the page.
const shown = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".labels .nl, .labels .el")]
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map((e) => ({ text: e.textContent!, box: e.getBoundingClientRect().toJSON() as DOMRect })),
  );
const overlapping = async (page: Page) => {
  const s = await shown(page);
  return s.flatMap((a, i) =>
    s
      .slice(i + 1)
      .filter((b) => a.box.left < b.box.right && b.box.left < a.box.right && a.box.top < b.box.bottom && b.box.top < a.box.bottom)
      .map((b) => `${a.text} / ${b.text}`),
  );
};

for (const view of ["A", "B", "C"] as const)
  test(`no two names overlap with Isaac the Focus and Abraham pinned, and a hidden name shows on hover: view ${view}`, async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem("wend.view", v), view);
    await page.goto("/");
    await focusIs(page, ABRAHAM);
    await panel(page).getByRole("button", { name: "Pin", exact: true }).click();
    await panel(page).getByRole("list", { name: /^Person/ }).getByRole("button", { name: /^Isaac/ }).click();
    await panel(page).getByRole("button", { name: "Make Focus" }).click();
    await focusIs(page, ISAAC);

    await expect.poll(() => overlapping(page)).toEqual([]);
    const names = (await shown(page)).map((s) => s.text);
    expect(names).toContain("Abraham");
    expect(names.length).toBeGreaterThan(10);

    // Hovering a disc whose name is hidden shows the name (a disc not under another name).
    const at = Object.fromEntries((await nodes(page)).map((n) => [n.id, n]));
    const hidden = await page.evaluate((at) => {
      for (const e of document.querySelectorAll<HTMLElement>(".labels .nl.crowded")) {
        const n = at[e.dataset.node!];
        if (document.elementFromPoint(n.x, n.y) instanceof HTMLCanvasElement) return n.id;
      }
    }, at);
    expect(hidden).toBeTruthy();
    await page.mouse.move(at[hidden!].x, at[hidden!].y);
    await expect(page.locator(`.labels .nl[data-node="${hidden}"]`)).toBeVisible();
  });
