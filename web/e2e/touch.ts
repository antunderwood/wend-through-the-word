import type { Page } from "@playwright/test";

// Touch gestures for the phone and tablet specs. A tap is Playwright's; a drag and a pinch go
// through the browser's own touch input (Chrome DevTools Protocol), as a finger's would, so the
// page's touch-action rules and the browser's own zoom and scroll apply to them.
type Point = { x: number; y: number };

async function touches(page: Page, steps: Point[][], stepMs = 16) {
  const cdp = await page.context().newCDPSession(page);
  const points = (ps: Point[]) => ps.map((p, id) => ({ x: p.x, y: p.y, id }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(steps[0]) });
  for (const ps of steps.slice(1)) {
    await page.waitForTimeout(stepMs);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(ps) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const lerp = (a: Point, b: Point, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const path = (from: Point, to: Point, n = 10) => Array.from({ length: n + 1 }, (_, i) => lerp(from, to, i / n));

// One finger from one point to another.
export const drag = (page: Page, from: Point, to: Point) => touches(page, path(from, to).map((p) => [p]));

// Two fingers: one rests at anchor, the other moves from gap above it to apart above it. Wider
// zooms in, narrower zooms out.
export const pinch = (page: Page, anchor: Point, gap: number, apart: number) =>
  touches(page, path({ x: anchor.x, y: anchor.y - gap }, { x: anchor.x, y: anchor.y - apart }).map((p) => [anchor, p]));

// Two taps on one point within the double tap time. The four touches are sent at once, so a
// machine slowed by software WebGL cannot spread them past it.
export async function doubleTap(page: Page, at: Point) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchEnd", touchPoints: Point[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const point = [{ x: at.x, y: at.y }];
  await Promise.all([send("touchStart", point), send("touchEnd", []), send("touchStart", point), send("touchEnd", [])]);
  await cdp.detach();
}

// Whether the page itself has been zoomed or scrolled, as a pinch or a drag on an unguarded page would.
export const pageMoved = (page: Page) =>
  page.evaluate(() => ({ scale: window.visualViewport!.scale, x: window.scrollX + window.visualViewport!.offsetLeft, y: window.scrollY + window.visualViewport!.offsetTop }));
