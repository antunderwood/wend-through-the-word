import { expect, type Locator, type Page } from "@playwright/test";
import { loadEnv } from "vite";
import { tileSettings } from "../src/tiles";

// The map specs' shared steps (#84 to #87), for the desktop and phone specs. Nothing in them reaches
// the network: every request to another host than the page's own is recorded, then answered with
// a blank tile or aborted, as when the reader is offline.

// The tile settings the page under test was built with: the e2e build reads VITE_ESRI_TOKEN as
// loadEnv does (the environment, then web/.env files), so with a token it is Esri
// (static-map-tiles-api.arcgis.com; CI builds with a dummy token), else OpenStreetMap (decision 199).
export const BUILT_TILES = tileSettings(loadEnv("e2e", `${import.meta.dirname}/..`).VITE_ESRI_TOKEN);
// Whether a URL is on the built tile host.
const tileHost = new URL(BUILT_TILES.url).hostname;
export const onTileHost = (url: string) => new URL(url).hostname === tileHost;

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

// The map's attribution, and how many lines it takes (decision 197: one, or it covers the foot of a
// short map). It names the built provider in a link.
export const attribution = (map: Locator) => map.locator(".leaflet-control-attribution");
export const lines = (credit: Locator) => credit.evaluate((e) => Math.round(e.clientHeight / parseFloat(getComputedStyle(e).lineHeight)));
export const providerLink = (map: Locator) => attribution(map).getByRole("link", { name: BUILT_TILES.credits[0].name, exact: true });

// Where on the page the Selected Place's dot is.
export const selectedDot = async (map: Locator) => (await map.locator(".map-place.selected .dot").boundingBox())!;

// Drags the map with the mouse, 60 px right and 30 px up, and waits until the Selected Place's dot
// has moved with it. The mouse is held still before it lets go, so the map does not drift on with
// motion: the library's drift, for a drag still moving in its last 50 ms, starts a frame later, which
// on software WebGL can be after the caller has taken the map for still.
export async function pan(page: Page, map: Locator) {
  const [dot, box] = [await selectedDot(map), (await map.boundingBox())!];
  await page.mouse.move(box.x + 30, box.y + box.height - 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 8 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect.poll(async () => (await selectedDot(map)).x - dot.x).toBeGreaterThan(30);
}
