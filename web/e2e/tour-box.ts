import { expect, test, type Page } from "@playwright/test";
import { focusIs } from "./scene";
import { doubleTap, drag } from "./touch";
import { STEPS } from "../src/tour";

// The tour box never covers the node a step asks the reader to tap (decision 187), on a desktop
// (e2e/tour-box.spec.ts) and a phone (e2e/phone/tour-box.spec.ts). For every step about a node in the
// scene, once the step is shown and the scene has settled, the box is clear of the node's disc and
// name, also after a camera move (and on a desktop a resize) during the step, and a click or tap at
// the disc's centre reaches the node: the step it asks for passes.
const JESUS = "person:jesus_905",
  GOD = "person:god_1324",
  PETER = "person:peter_2745";
type Point = { x: number; y: number };
const tour = (page: Page) => page.getByRole("dialog", { name: "Tour" });
const stepIs = (page: Page, n: number) => expect(tour(page)).toContainText(`Step ${n} of ${STEPS.length}`);
const doIt = (page: Page, coarse: boolean) => tour(page).getByRole("button", { name: "Do it for me" })[coarse ? "tap" : "click"]();

// What is wrong with how the step shows the node, "" when nothing: the node's disc and name (when
// shown) against the box, and what lies at the disc's centre. Read twice, two frames apart, so a
// scene still moving is not taken as settled.
const problems = (page: Page, id: string) =>
  page.evaluate(async (id) => {
    const read = () => {
      const d = window.wendGraph!.nodeRect(id);
      if (!d) return { at: "", found: [`${id} is not drawn`] };
      const name = document.querySelector(`[data-tour="scene"] [data-node="${id}"]`),
        n = name?.checkVisibility({ visibilityProperty: true }) ? name.getBoundingClientRect() : null;
      const box = document.querySelector('[role="dialog"][aria-label="Tour"]')!.getBoundingClientRect();
      const apart = (a: DOMRect, b: DOMRect) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      const found: string[] = [];
      if (!apart(box, d)) found.push(`the box is over ${id}'s disc`);
      if (n && n.width && !apart(box, n)) found.push(`the box is over ${id}'s name`);
      const [x, y] = [d.left + d.width / 2, d.top + d.height / 2];
      const scene = document.querySelector('[data-tour="scene"]')!,
        hit = document.elementFromPoint(x, y);
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) found.push(`${id}'s disc is off screen`);
      else if (!scene.contains(hit)) found.push(`${id}'s disc is under ${hit?.outerHTML.slice(0, 60)}`);
      return { at: [d.x, d.y, d.width, n?.x ?? 0, n?.y ?? 0].map(Math.round).join(), found };
    };
    const a = read();
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const b = read();
    return a.at !== b.at ? "still moving" : b.found.join("; ");
  }, id);
// A mouse drag glides on (damped) for a number of frames, slow on software WebGL.
const clear = (page: Page, id: string) => expect.poll(() => problems(page, id), { timeout: 30_000 }).toBe("");
const disc = async (page: Page, id: string): Promise<Point> => {
  const d = await page.evaluate((id) => window.wendGraph!.nodeRect(id)!.toJSON(), id);
  return { x: d.x + d.width / 2, y: d.y + d.height / 2 };
};

// A camera move during the step: a drag from a bare point of the scene, 40 px towards the box (in
// the tilted plane the scene follows the pointer, so the node moves towards the box).
async function moveCamera(page: Page, id: string, coarse: boolean) {
  const n = await disc(page, id),
    b = (await tour(page).boundingBox())!;
  const [dx, dy] = [b.x + b.width / 2 - n.x, b.y + b.height / 2 - n.y],
    k = 40 / Math.hypot(dx, dy);
  const from = await page.evaluate(() => {
    const s = document.querySelector('[data-tour="scene"]')!.getBoundingClientRect();
    for (let y = s.top + 60; y < s.bottom - 60; y += 20)
      for (let x = s.left + 60; x < s.right - 60; x += 20) if (document.elementFromPoint(x, y)?.matches('[data-tour="scene"] canvas')) return { x, y };
  });
  expect(from).toBeDefined();
  const to = { x: from!.x + dx * k, y: from!.y + dy * k };
  if (coarse) await drag(page, from!, to);
  else {
    await page.mouse.move(from!.x, from!.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
}

export function tourBoxSpecs(sizes: { width: number; height: number }[], views: string[], coarse: boolean) {
  test.use({ reducedMotion: "reduce" });
  for (const size of sizes)
    for (const view of views)
      test.describe(`${size.width} x ${size.height}`, () => {
        test.use({ viewport: size });

        test(`the box keeps clear of the step's node, and a ${coarse ? "tap" : "click"} at its disc reaches it, in view ${view}`, async ({ page }) => {
          test.slow(); // every scene step, each waiting for the scene to settle twice
          await page.addInitScript((view) => localStorage.setItem("wend.view", view), view);
          await page.goto("/");
          await focusIs(page, JESUS);
          const help = page.getByRole("button", { name: "Help: take the tour" });
          await (coarse ? help.tap() : help.click());
          const press = async (at: Point) => (coarse ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));

          // The camera step is about the Focus, John 1:1; a camera move passes it.
          await stepIs(page, 1);
          const verse = await page.evaluate(() => window.wendGraph!.testNodes().find((n) => n.role === "focus")!.id);
          await clear(page, verse);
          await doIt(page, coarse);
          await stepIs(page, 2);
          await doIt(page, coarse);
          // Select God, then Jesus Christ, at their discs.
          for (const [n, id] of [
            [3, GOD],
            [4, JESUS],
          ] as const) {
            await stepIs(page, n);
            await clear(page, id);
            await moveCamera(page, id, coarse);
            await clear(page, id);
            // A desktop window made smaller during the step, and back.
            if (!coarse) {
              await page.setViewportSize({ width: size.width - 120, height: size.height - 80 });
              await clear(page, id);
              await page.setViewportSize(size);
              await clear(page, id);
            }
            await press(await disc(page, id));
            await stepIs(page, n + 1);
          }
          await doIt(page, coarse);
          await stepIs(page, 6);
          await doIt(page, coarse);
          // Simon Peter is in the scene, whatever the ring is on: a double click or tap at his disc.
          await stepIs(page, 7);
          await clear(page, PETER);
          await moveCamera(page, PETER, coarse);
          await clear(page, PETER);
          const peter = await disc(page, PETER);
          await (coarse ? doubleTap(page, peter) : page.mouse.dblclick(peter.x, peter.y));
          await focusIs(page, PETER);
          // Jesus Christ is in Simon Peter's Ring 1: the step says he can be selected there, and the
          // ring moves to Pin.
          await stepIs(page, 8);
          await expect(tour(page)).toContainText(`${coarse ? "Tap" : "Click"} him in the scene or in the Your Path bar to select him`);
          await clear(page, JESUS);
          await moveCamera(page, JESUS, coarse);
          await clear(page, JESUS);
          await press(await disc(page, JESUS));
          await expect(page.locator(".labels .nl.selected")).toHaveAttribute("data-node", JESUS);
          const pin = page.locator('[data-tour="pin"]');
          await expect
            .poll(async () => {
              const [r, p] = [await page.locator(".tour-target").boundingBox(), await pin.boundingBox()];
              return !!r && !!p && Math.abs(r.x + 5 - p.x) <= 1.5 && Math.abs(r.y + 5 - p.y) <= 1.5;
            })
            .toBe(true);
          await clear(page, JESUS);
          await doIt(page, coarse);
          await stepIs(page, 9);
        });
      });
}
