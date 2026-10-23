import { expect, test, type Page } from "@playwright/test";
import { focusIs, nodes, type OnScreen } from "../scene";
import { pinchFromName, selectedIs, tappable } from "../touch-input";

// The owner's phone test: after a pin, a tap on a node did nothing. The pin's ring lies off the
// screen, so a pinch brings it in; a pinch whose second finger began on a name left the scene
// taking every later tap for the end of a pinch.
const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473";
const sheet = (page: Page) => page.getByRole("region", { name: "Sheet" });
const details = (page: Page) => sheet(page).getByRole("tabpanel", { name: "Details" });

test.use({ reducedMotion: "reduce", viewport: { width: 325, height: 600 } });

for (const view of ["A", "C"]) {
  test(`after a pin and a pinch from a name, a tap selects Ring 1, the pin, its ring, and a Shared Node, in view ${view}`, async ({ page }) => {
    test.slow(); // a pin, a pinch, and four taps, each drawn by software WebGL
    await page.addInitScript(() => localStorage.setItem("wend.hintDismissed", "1"));
    await page.goto(`/?view=${view}`);
    await focusIs(page, ABRAHAM);
    const sarah = await tappable(page, (n) => n.id === SARAH);
    await page.touchscreen.tap(sarah.x, sarah.y);
    await details(page).getByRole("button", { name: "Pin", exact: true }).tap();
    await expect.poll(async () => (await nodes(page)).find((n) => n.id === SARAH)?.role).toBe("pinned");
    // A pinch out to bring the pin's ring in, its second finger on the Focus's name.
    await pinchFromName(page);

    const shared = new Set(await page.locator(".labels .nl.shared").evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.node!)));
    const kinds: [string, (n: OnScreen) => boolean][] = [
      ["Ring 1", (n) => n.role === "ring1" && !shared.has(n.id)],
      ["the pin", (n) => n.role === "pinned"],
      ["the pin's ring", (n) => n.role === "pinring"],
      ["a Shared Node", (n) => shared.has(n.id)],
    ];
    for (const [kind, which] of kinds) {
      const target = await tappable(page, which);
      await page.touchscreen.tap(target.x, target.y);
      await test.step(kind, () => selectedIs(page, target.id));
    }
  });
}
