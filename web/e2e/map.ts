import { expect, type Locator, type Page } from "@playwright/test";

// The map specs' shared steps (#84 to #87), for the desktop and phone specs. Nothing in them reaches
// the network: every request to another host than the page's own is recorded, then answered with
// a blank tile or aborted, as when the reader is offline.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

export async function thirdParty(page: Page, answer: "tile" | "abort" = "abort") {
  const asked: string[] = [];
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => (asked.push(route.request().url()), answer === "tile" ? route.fulfill({ contentType: "image/png", body: TILE }) : route.abort()),
  );
  return asked;
}

// Opens the map in this panel, past the notice the first time in a session; on a phone by a tap.
export async function openMap(within: Locator, touch = false) {
  const press = (l: Locator) => (touch ? l.tap() : l.click());
  await press(within.getByRole("button", { name: "Show map" }));
  const go = within.getByRole("button", { name: "Continue" });
  await expect(go.or(within.getByRole("button", { name: "Hide map" }))).toBeVisible();
  if (await go.isVisible()) await press(go);
}

// Where on the page the Selected Place's dot is.
export const selectedDot = async (map: Locator) => (await map.locator(".map-place.selected .dot").boundingBox())!;

// Drags the map with the mouse, 60 px right and 30 px up, and waits until the Selected Place's dot
// has moved with it.
export async function pan(page: Page, map: Locator) {
  const [dot, box] = [await selectedDot(map), (await map.boundingBox())!];
  await page.mouse.move(box.x + 30, box.y + box.height - 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await selectedDot(map)).x - dot.x).toBeGreaterThan(30);
}
